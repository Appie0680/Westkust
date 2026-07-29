import { Events, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import {
  getBotMessage,
  isBotOwner,
  isCommandCategoryEnabled,
  isMaintenanceMode,
} from '../config/bot.js';
import botConfig from '../config/bot.js';
import { handleApplicationModal } from '../commands/Community/apply.js';
import { handleInteractionError, createError, ErrorTypes, ErrorCodes } from '../utils/errorHandler.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { createInteractionTraceContext, runWithTraceContext } from '../utils/logger.js';
import { validateChatInputPayloadOrThrow } from '../utils/commandInputValidation.js';
import { enforceAbuseProtection, formatCooldownDuration } from '../utils/abuseProtection.js';
import { isCommandEnabled } from '../services/commandAccessService.js';
import { resolveSlashAccessKey } from '../utils/messageAdapter.js';
import { isCollectorManagedComponent } from '../utils/collectorComponents.js';
import { ResponseCoordinator } from '../utils/responseCoordinator.js';
import { enforceDefaultCommandPermissions } from '../utils/permissionGuard.js';

const COMMAND_ERROR_SUBTYPES = {
  warn: 'warn_failed',
  kick: 'kick_failed',
  ban: 'ban_failed',
  unban: 'unban_failed',
  timeout: 'timeout_failed',
  untimeout: 'untimeout_failed',
  warnings: 'warnings_view_failed',
  ticket: 'ticket_failed',
  serverstats: 'serverstats_failed',
  gcreate: 'giveaway_failed',
  gend: 'giveaway_failed',
  gdelete: 'giveaway_failed',
  greroll: 'giveaway_failed',
};

// Vragenlijst voor Marketing
if (!global.marketingQuestions) {
  global.marketingQuestions = [
    "Wat is jouw volledige In-Game / Karakter Naam?",
    "Wat is jouw Leeftijd?",
    "1/8. Vertel kort iets over jezelf.",
    "2/8. Waarom wil je in het marketing team werken?",
    "3/8. Waarom wil je specifiek bij Nexus Community werken?",
    "4/8. Wat zijn jouw sterke en zwakke punten?",
    "5/8. Hoe ga je om met opbouwende kritiek en feedback?",
    "6/8. Waarom moeten wij juist JOU aannemen?",
    "7/8. Wanneer en hoeveel ben je beschikbaar om te beginnen? (bijv. direct, over 2 weken)",
    "8/8. Heb je tot slot nog vragen aan ons?"
  ];
}

if (!global.userApplySessions) global.userApplySessions = new Map();

function withTraceContext(context = {}, traceContext = {}) {
  return {
    traceId: traceContext.traceId,
    guildId: context.guildId || traceContext.guildId,
    userId: context.userId || traceContext.userId,
    command: context.commandName || traceContext.command,
    ...context
  };
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    const interactionTraceContext = createInteractionTraceContext(interaction);
    interaction.traceContext = interactionTraceContext;
    interaction.traceId = interactionTraceContext.traceId;

    return runWithTraceContext(interactionTraceContext, async () => {
      try {
        InteractionHelper.patchInteractionResponses(interaction);
        ResponseCoordinator.attach(interaction);

        if (interaction.isChatInputCommand()) {
          try {
            logger.info(`Command executed: /${interaction.commandName} by ${interaction.user.tag}`, {
              event: 'interaction.command.received',
              traceId: interactionTraceContext.traceId,
              guildId: interaction.guildId,
              userId: interaction.user?.id,
              command: interaction.commandName
            });

            validateChatInputPayloadOrThrow(interaction, withTraceContext({
              type: 'command_input_validation',
              commandName: interaction.commandName
            }, interactionTraceContext));

            const command = client.commands.get(interaction.commandName);

            if (!command) {
              throw createError(
                `No command matching ${interaction.commandName} was found.`,
                ErrorTypes.CONFIGURATION,
                'Sorry, that command does not exist.',
                withTraceContext({ commandName: interaction.commandName }, interactionTraceContext)
              );
            }

            if (isMaintenanceMode() && !isBotOwner(interaction.user.id)) {
              throw createError(
                'Bot is in maintenance mode',
                ErrorTypes.CONFIGURATION,
                getBotMessage('maintenanceMode'),
                withTraceContext({ commandName: interaction.commandName }, interactionTraceContext)
              );
            }

            if (!isCommandCategoryEnabled(command.category)) {
              throw createError(
                `Feature disabled for category ${command.category}`,
                ErrorTypes.CONFIGURATION,
                getBotMessage('commandDisabled'),
                withTraceContext({ commandName: interaction.commandName, category: command.category }, interactionTraceContext)
              );
            }

            const defaultCooldownSec = Number(botConfig.commands?.defaultCooldown) || 0;
            if (defaultCooldownSec > 0 && !isBotOwner(interaction.user.id)) {
              const cooldownKey = `${interaction.user.id}:${interaction.commandName}`;
              const expiresAt = client.cooldowns.get(cooldownKey);

              if (expiresAt && Date.now() < expiresAt) {
                const remainingSec = Math.ceil((expiresAt - Date.now()) / 1000);
                throw createError(
                  `Default command cooldown active for ${interaction.commandName}`,
                  ErrorTypes.RATE_LIMIT,
                  getBotMessage('cooldownActive', { time: `${remainingSec}s` }),
                  withTraceContext({ commandName: interaction.commandName, remainingSec }, interactionTraceContext)
                );
              }

              client.cooldowns.set(cooldownKey, Date.now() + defaultCooldownSec * 1000);
            }

            const abuseProtection = await enforceAbuseProtection(interaction, command, interaction.commandName);
            if (!abuseProtection.allowed) {
              const formattedCooldown = formatCooldownDuration(abuseProtection.remainingMs);
              throw createError(
                `Risky command cooldown active for ${interaction.commandName}`,
                ErrorTypes.RATE_LIMIT,
                `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,
                withTraceContext({
                  commandName: interaction.commandName,
                  subtype: 'command_cooldown',
                  expected: true,
                  cooldownMs: abuseProtection.remainingMs,
                  cooldownWindowMs: abuseProtection.policy?.windowMs,
                  cooldownMaxAttempts: abuseProtection.policy?.maxAttempts
                }, interactionTraceContext)
              );
            }

            let guildConfig = null;
            if (interaction.guild) {
              guildConfig = await getGuildConfig(client, interaction.guild.id, interactionTraceContext);
              const accessKey = resolveSlashAccessKey(interaction);
              if (!(await isCommandEnabled(client, interaction.guild.id, accessKey, command.category))) {
                throw createError(
                  `Command ${accessKey} is disabled in this guild`,
                  ErrorTypes.CONFIGURATION,
                  'This command has been disabled for this server.',
                  withTraceContext({ commandName: accessKey, guildId: interaction.guild.id }, interactionTraceContext)
                );
              }
            }

            const permissionAllowed = await enforceDefaultCommandPermissions(interaction, command, {
              source: 'interactionCreate',
              guildConfig,
            });
            if (!permissionAllowed) {
              return;
            }

            await command.execute(interaction, guildConfig, client);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({
              type: 'command',
              commandName: interaction.commandName,
              subtype: COMMAND_ERROR_SUBTYPES[interaction.commandName] || error?.context?.subtype,
            }, interactionTraceContext));
          }
        } else if (interaction.isAutocomplete()) {
          const autocompleteCommand = client.commands.get(interaction.commandName);
          if (autocompleteCommand?.autocomplete) {
            try {
              await autocompleteCommand.autocomplete(interaction, client);
            } catch (error) {
              logger.error('Error handling command autocomplete:', {
                error: error.message,
                guildId: interaction.guildId,
                commandName: interaction.commandName,
              });
              await interaction.respond([]).catch(() => {});
            }
            return;
          }

          const focusedOption = interaction.options.getFocused(true);
          
          if (interaction.commandName === 'apply' && focusedOption.name === 'application') {
            try {
              const { getApplicationRoles } = await import('../utils/database.js');
              const roles = await getApplicationRoles(client, interaction.guildId);
              const roleName = interaction.options.getString('application', false);

              const filtered = roles.filter(role =>
                role.enabled !== false && 
                role.name.toLowerCase().startsWith(roleName?.toLowerCase() || '')
              );
              
              await interaction.respond(
                filtered.slice(0, 25).map(role => ({
                  name: `${role.name}${role.enabled === false ? ' (disabled)' : ''}`,
                  value: role.name
                }))
              );
            } catch (error) {
              logger.error('Error handling autocomplete:', {
                error: error.message,
                guildId: interaction.guildId,
                commandName: interaction.commandName
              });
              await interaction.respond([]);
            }
          } else if (interaction.commandName === 'app-admin' && focusedOption.name === 'application') {
            try {
              const { getApplicationRoles } = await import('../utils/database.js');
              const roles = await getApplicationRoles(client, interaction.guildId);
              const appName = interaction.options.getString('application', false);

              const filtered = roles.filter(role =>
                role.name.toLowerCase().startsWith(appName?.toLowerCase() || '')
              );
              
              await interaction.respond(
                filtered.slice(0, 25).map(role => ({
                  name: `${role.name}${role.enabled === false ? ' (disabled)' : ''}`,
                  value: role.name
                }))
              );
            } catch (error) {
              logger.error('Error handling app-admin autocomplete:', {
                error: error.message,
                guildId: interaction.guildId,
                commandName: interaction.commandName
              });
              await interaction.respond([]);
            }
          } else if (interaction.commandName === 'reactroles' && focusedOption.name === 'panel') {
            try {
              const { getAllReactionRoleMessages, deleteReactionRoleMessage } = await import('../services/reactionRoleService.js');
              const guildId = interaction.guildId;
              const guild = interaction.guild;
              
              let panels = await getAllReactionRoleMessages(client, guildId);
              
              if (!panels || panels.length === 0) {
                await interaction.respond([]);
                return;
              }

              const validPanels = [];
              for (const panel of panels) {
                if (!panel.messageId || !panel.channelId) {
                  continue;
                }
                
                const channel = guild.channels.cache.get(panel.channelId);
                if (!channel) {
                  await deleteReactionRoleMessage(client, guildId, panel.messageId).catch(() => {});
                  continue;
                }
                
                const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
                if (!msg) {
                  await deleteReactionRoleMessage(client, guildId, panel.messageId).catch(() => {});
                  continue;
                }
                validPanels.push(panel);
              }
              
              if (validPanels.length === 0) {
                await interaction.respond([]);
                return;
              }
              
              const choices = await Promise.all(
                validPanels.slice(0, 25).map(async panel => {
                  try {
                    const channel = guild.channels.cache.get(panel.channelId);
                    if (!channel) return null;
                    
                    const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
                    if (!msg) return null;
                    
                    const title = msg?.embeds?.[0]?.title ?? 'Untitled Panel';
                    const channelName = channel?.name ?? 'unknown';
                    
                    return {
                      name: `${title} (${channelName})`.substring(0, 100),
                      value: panel.messageId
                    };
                  } catch (e) {
                    return null;
                  }
                })
              );
              
              const validChoices = choices.filter(c => c !== null);
              await interaction.respond(validChoices);
            } catch (error) {
              logger.error('Error handling reactroles autocomplete:', {
                error: error.message,
                guildId: interaction.guildId,
                commandName: interaction.commandName
              });
              await interaction.respond([]);
            }
          }
        } else if (interaction.isButton()) {
          // --- APPY-STYLE SOLLICITATIE KNOPPEN ---
          if (interaction.customId === 'start_marketing_application') {
            try {
              const dmChannel = await interaction.user.createDM().catch(() => null);
              if (!dmChannel) {
                return interaction.reply({
                  content: '❌ Je hebt je privéberichten (DM) uitstaan! Zet je DM open voor deze server om te kunnen solliciteren.',
                  flags: MessageFlags.Ephemeral
                });
              }

              global.userApplySessions.set(interaction.user.id, {
                step: 0,
                answers: [],
                guildId: interaction.guildId
              });

              const startEmbed = new EmbedBuilder()
                .setTitle('💼 Sollicitatie Marketing Team • Nexus Community')
                .setColor('#00F0FF')
                .setDescription(
                  `Super dat je wilt solliciteren! We gaan nu stap-voor-stap de vragen doornemen.\n\n` +
                  `*Antwoord simpelweg op de berichten van de bot.*`
                );

              await dmChannel.send({ embeds: [startEmbed] }).catch(() => null);

              const firstQuestionEmbed = new EmbedBuilder()
                .setTitle(`Vraag 1 van ${global.marketingQuestions.length}`)
                .setColor('#00FF88')
                .setDescription(`**${global.marketingQuestions[0]}**\n\n*Reageer met een bericht op deze DM met jouw antwoord.*`);

              await dmChannel.send({ embeds: [firstQuestionEmbed] }).catch(() => null);

              return interaction.reply({
                content: '📩 **Check je DM!** De sollicitatie vragenlijst is naar je privéberichten gestuurd.',
                flags: MessageFlags.Ephemeral
              });
            } catch (e) {
              logger.error('Fout bij starten DM sollicitatie:', e);
              return interaction.reply({ content: '❌ Kon geen DM sturen.', flags: MessageFlags.Ephemeral });
            }
          }

          if (interaction.customId === 'toggle_application_status') {
            if (!interaction.member.permissions.has('Administrator')) {
              return interaction.reply({ content: '❌ Alleen beheerders kunnen dit paneel sluiten!', flags: MessageFlags.Ephemeral });
            }

            const msg = interaction.message;
            const embed = EmbedBuilder.from(msg.embeds[0]);
            const isCurrentlyOpen = embed.data.description.includes('`OPEN`');

            if (isCurrentlyOpen) {
              embed.setColor('#FF0033');
              embed.setDescription(embed.data.description.replace('🟢 **Status:** `OPEN`', '🔴 **Status:** `GESLOTEN`'));
              
              const row = ActionRowBuilder.from(msg.components[0]);
              row.components[0].setDisabled(true);
              row.components[1].setLabel('🔓 Sollicitaties Openen (Beheer)').setStyle(ButtonStyle.Success);

              await msg.edit({ embeds: [embed], components: [row] });
              return interaction.reply({ content: '🔒 Sollicitaties zijn nu **GESLOTEN**.', flags: MessageFlags.Ephemeral });
            } else {
              embed.setColor('#00F0FF');
              embed.setDescription(embed.data.description.replace('🔴 **Status:** `GESLOTEN`', '🟢 **Status:** `OPEN`'));
              
              const row = ActionRowBuilder.from(msg.components[0]);
              row.components[0].setDisabled(false);
              row.components[1].setLabel('🔒 Sollicitaties Sluiten (Beheer)').setStyle(ButtonStyle.Secondary);

              await msg.edit({ embeds: [embed], components: [row] });
              return interaction.reply({ content: '🔓 Sollicitaties zijn nu weer **GEOPEND**.', flags: MessageFlags.Ephemeral });
            }
          }

          if (interaction.customId.startsWith('accept_app_') || interaction.customId.startsWith('deny_app_')) {
            if (!interaction.member.permissions.has('Administrator')) {
              return interaction.reply({ content: '❌ Alleen beheerders kunnen sollicitaties beoordelen.', flags: MessageFlags.Ephemeral });
            }

            const targetUserId = interaction.customId.split('_')[2];
            const isAccept = interaction.customId.startsWith('accept_app_');
            const targetUser = await client.users.fetch(targetUserId).catch(() => null);

            const msg = interaction.message;
            const oldEmbed = msg.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            if (isAccept) {
              newEmbed.setColor('#00FF88');
              newEmbed.setTitle(`✅ SOLLICITATIE GOEDGEKEURD • ${targetUser?.username || targetUserId}`);
              newEmbed.setFooter({ text: `Goedgekeurd door ${interaction.user.tag}` });

              if (targetUser) {
                await targetUser.send({
                  content: `🎉 **Gefeliciteerd!** Jouw sollicitatie voor het **Marketing Team** van Nexus Community is **GOEDGEKEURD**!\n\n📩 Je mag nu een ticket aanmaken op de Discord server om je rol te ontvangen.`
                }).catch(() => null);
              }
            } else {
              newEmbed.setColor('#FF0033');
              newEmbed.setTitle(`❌ SOLLICITATIE AFGEKEURD • ${targetUser?.username || targetUserId}`);
              newEmbed.setFooter({ text: `Afgekeurd door ${interaction.user.tag}` });

              if (targetUser) {
                await targetUser.send({
                  content: `❌ Jouw sollicitatie voor het **Marketing Team** van Nexus Community is helaas **AFGEKEURD**.\n\nVolgende keer beter, bedankt voor je inzet en sollicitatie!`
                }).catch(() => null);
              }
            }

            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('disabled_1').setLabel(isAccept ? '✅ Goedgekeurd' : '❌ Afgekeurd').setStyle(isAccept ? ButtonStyle.Success : ButtonStyle.Danger).setDisabled(true)
            );

            await msg.edit({ embeds: [newEmbed], components: [disabledRow] });
            return interaction.reply({ content: `✅ Sollicitatie van <@${targetUserId}> is succesvol ${isAccept ? 'goedgekeurd' : 'afgekeurd'}!`, flags: MessageFlags.Ephemeral });
          }

          if (interaction.customId.startsWith('shared_todo_')) {
            const parts = interaction.customId.split('_');
            const buttonType = parts.slice(0, 3).join('_');
            const listId = parts[3];
            const button = client.buttons.get(buttonType);

            if (button) {
              try {
                await button.execute(interaction, client, [listId]);
              } catch (error) {
                await handleInteractionError(interaction, error, withTraceContext({
                  type: 'button',
                  customId: interaction.customId,
                  handler: 'todo'
                }, interactionTraceContext));
              }
            } else {
              throw createError(
                `No button handler found for ${buttonType}`,
                ErrorTypes.CONFIGURATION,
                'This button is not available.',
                withTraceContext({ buttonType }, interactionTraceContext)
              );
            }
            return;
          }

          const [customId, ...args] = interaction.customId.split(':');
          const button = client.buttons.get(customId);

          if (!button) {
            if (!interaction.customId.includes(':') || isCollectorManagedComponent(customId)) {
              return;
            }

            throw createError(
              `No button handler found for ${customId}`,
              ErrorTypes.CONFIGURATION,
              'This button is not available.',
              withTraceContext({ customId }, interactionTraceContext)
            );
          }

          try {
            await button.execute(interaction, client, args);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({
              type: 'button',
              customId: interaction.customId,
              handler: 'general'
            }, interactionTraceContext));
          }
        } else if (interaction.isStringSelectMenu()) {
          // --- PARTNER LEADERBOARD UITBETALINGSKEUZE CHECK ---
          if (interaction.customId === 'select_payout_method') {
            try {
              if (!global.userPayoutChoices) global.userPayoutChoices = new Map();
              
              const selectedMethod = interaction.values[0];
              global.userPayoutChoices.set(interaction.user.id, selectedMethod);

              const methods = global.payoutMethods || new Map([
                ['robux', { name: 'Robux', rate: 10, target: 800, unit: 'Robux' }],
                ['springbank', { name: 'Springbank Coins', rate: 83, target: 500, unit: 'Coins' }],
                ['geld', { name: 'Geld (€)', rate: 0.12, target: 10.00, unit: '€' }]
              ]);

              const methodInfo = methods.get(selectedMethod);
              const methodName = methodInfo ? methodInfo.name : selectedMethod;

              await interaction.reply({
                content: `✅ Jouw uitbetalingsmethode is ingesteld op **${methodName}**! Alle volgende partners die je plaatst tellen mee voor dit doel.`,
                flags: MessageFlags.Ephemeral
              });

              if (global.updatePartnerLeaderboard) {
                await global.updatePartnerLeaderboard(client, interaction.guild);
              }
            } catch (err) {
              logger.error('Error handling partner payout select menu:', {
                error: err.message,
                guildId: interaction.guildId,
                userId: interaction.user?.id
              });
            }
            return;
          }

          const [customId, ...args] = interaction.customId.split(':');
          const selectMenu = client.selectMenus.get(customId);

          if (!selectMenu) {
            if (!interaction.customId.includes(':') || isCollectorManagedComponent(customId)) {
              return;
            }

            throw createError(
              `No select menu handler found for ${customId}`,
              ErrorTypes.CONFIGURATION,
              'This select menu is not available.',
              withTraceContext({ customId }, interactionTraceContext)
            );
          }

          try {
            await selectMenu.execute(interaction, client, args);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({
              type: 'select_menu',
              customId: interaction.customId
            }, interactionTraceContext));
          }
        } else if (interaction.isModalSubmit()) {
          if (interaction.customId.startsWith('app_modal_')) {
            try {
              await handleApplicationModal(interaction);
            } catch (error) {
              await handleInteractionError(interaction, error, withTraceContext({
                type: 'modal',
                customId: interaction.customId,
                handler: 'application'
              }, interactionTraceContext));
            }
            return;
          }

          if (
            interaction.customId.startsWith('app_review_')
            || interaction.customId.startsWith('jtc_')
            || interaction.customId.startsWith('config_wizard_modal:')
            || interaction.customId.startsWith('log_dash_channel_modal:')
            || interaction.customId.startsWith('log_dash_filter_modal:')
          ) {
            logger.debug(`Skipping modal handler lookup for inline-awaited modal: ${interaction.customId}`, {
              event: 'interaction.modal.inline_skipped',
              traceId: interactionTraceContext.traceId
            });
            return;
          }

          const [customId, ...args] = interaction.customId.split(':');
          const modal = client.modals.get(customId);

          if (!modal) {
            if (!interaction.customId.includes(':')) {

              return;
            }

            throw createError(
              `No modal handler found for ${customId}`,
              ErrorTypes.CONFIGURATION,
              'This form is not available.',
              withTraceContext({ customId }, interactionTraceContext)
            );
          }

          try {
            await modal.execute(interaction, client, args);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({
              type: 'modal',
              customId: interaction.customId,
              handler: 'general'
            }, interactionTraceContext));
          }
        }
      } catch (error) {
        logger.error('Unhandled error in interactionCreate:', {
          event: 'interaction.unhandled_error',
          errorCode: ErrorCodes.INTERACTION_UNHANDLED,
          error,
          traceId: interactionTraceContext.traceId,
          interactionId: interaction.id,
          guildId: interaction.guildId,
          userId: interaction.user?.id
        });

        try {
          await handleInteractionError(interaction, error, withTraceContext({
            type: 'interaction',
            commandName: interaction.commandName,
            customId: interaction.customId,
            source: 'interactionCreate.unhandled'
          }, interactionTraceContext));
        } catch (replyError) {
          logger.error('Failed to send fallback error response:', {
            event: 'interaction.error_response_failed',
            errorCode: ErrorCodes.INTERACTION_RESPONSE_FAILED,
            error: replyError,
            traceId: interactionTraceContext.traceId
          });
        }
      }
    });
  }
};

