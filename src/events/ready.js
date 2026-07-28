import { Events, EmbedBuilder } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import { reconcileTicketPanels, reconcileVerificationPanels, reconcileReactionRolePanelHealth } from "../services/panelHealthService.js";
import { reconcileLevelRoles } from "../services/leveling/levelRoleSyncService.js";
import { initRiffyAfterReady } from "../services/music/riffySetup.js";

const ABSENT_ROLE_ID = '1531246008925945946';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      if (client.config?.features?.music) {
        initRiffyAfterReady(client);
      }

      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      const ticketPanelSummary = await reconcileTicketPanels(client);
      startupLog(
        `Ticket panel health: scanned ${ticketPanelSummary.scannedGuilds} guilds, healthy ${ticketPanelSummary.healthyPanels}, deleted ${ticketPanelSummary.deletedPanels}, missing channel ${ticketPanelSummary.missingChannels}, recovered ${ticketPanelSummary.recoveredIds}, errors ${ticketPanelSummary.errors}`
      );

      const verificationPanelSummary = await reconcileVerificationPanels(client);
      startupLog(
        `Verification panel health: scanned ${verificationPanelSummary.scannedGuilds} guilds, healthy ${verificationPanelSummary.healthyPanels}, deleted ${verificationPanelSummary.deletedPanels}, missing channel ${verificationPanelSummary.missingChannels}, recovered ${verificationPanelSummary.recoveredIds}, errors ${verificationPanelSummary.errors}`
      );

      const reactionRolePanelSummary = await reconcileReactionRolePanelHealth(client);
      startupLog(
        `Reaction role panel health: scanned ${reactionRolePanelSummary.scannedPanels} panels, healthy ${reactionRolePanelSummary.healthyPanels}, deleted ${reactionRolePanelSummary.deletedPanels}, missing channel ${reactionRolePanelSummary.missingChannels}, recovered ${reactionRolePanelSummary.recoveredIds}, errors ${reactionRolePanelSummary.errors}`
      );

      const levelRoleSummary = await reconcileLevelRoles(client);
      startupLog(
        `Level role sync: scanned ${levelRoleSummary.scannedGuilds} guilds, pruned ${levelRoleSummary.prunedRewardEntries} stale rewards, re-awarded ${levelRoleSummary.rolesReAwarded} roles, errors ${levelRoleSummary.errors}`
      );

      // --- AUTOMATISCHE AFWEZIGHEIDS CHECKER (ELKE 5 MINUTEN) ---
      setInterval(async () => {
        if (!global.activeAbsences || global.activeAbsences.size === 0) return;

        const now = new Date();

        for (const [userId, absence] of global.activeAbsences.entries()) {
          try {
            if (now >= new Date(absence.endDate)) {
              const guild = client.guilds.cache.get(absence.guildId);
              if (!guild) continue;

              // 1. AFWEZIG ROL VERWIJDEREN VAN HET LID
              const member = await guild.members.fetch(userId).catch(() => null);
              if (member) {
                await member.roles.remove(ABSENT_ROLE_ID).catch((e) => {
                  logger.warn(`Kon afwezig rol niet verwijderen van ${userId}:`, e.message);
                });
              }

              // 2. KANAAL OPZOEKEN (#💤〢absent)
              const channel = guild.channels.cache.get(absence.channelId) || 
                guild.channels.cache.find(c => 
                  c.name === '💤〢absent' || 
                  c.name.includes('absent') || 
                  c.name.includes('afwezig')
                );

              if (channel) {
                // Update het originele afmeldingsbericht naar afgelopen
                if (absence.messageId) {
                  const originalMsg = await channel.messages.fetch(absence.messageId).catch(() => null);
                  if (originalMsg && originalMsg.embeds.length > 0) {
                    const expiredEmbed = EmbedBuilder.from(originalMsg.embeds[0])
                      .setColor('#808080') // Grijs voor afgelopen
                      .setDescription(
                        `>>> **👤 Gebruiker:** <@${userId}>\n` +
                        `**📛 Naam:** \`${absence.name}\`\n` +
                        `**🔴 Status:** \`🔴 Afgelopen / Terug\`\n` +
                        `**📅 Periode:** \`${absence.startDateStr}\` **t/m** \`${absence.endDateStr}\`\n\n` +
                        `**📝 Reden:**\n> ${absence.reason.replace(/\n/g, '\n> ')}`
                      );

                    await originalMsg.edit({ embeds: [expiredEmbed] }).catch(() => null);
                  }
                }

                // 3. STUUR DE HERINNERINGS-TAG
                await channel.send({
                  content: `Let op <@${userId}> je afmelding is weer voorbij! Grinden maarrr topperrr 🔥🚀`
                }).catch(() => null);
              }

              // Verwijder uit de lijst van actieve afmeldingen
              global.activeAbsences.delete(userId);
            }
          } catch (err) {
            logger.error(`Fout bij verwerken verlopen afmelding voor ${userId}:`, err);
          }
        }
      }, 5 * 60 * 1000); // 5 minuten interval

    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};

