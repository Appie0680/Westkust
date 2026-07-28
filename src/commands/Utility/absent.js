import { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder 
} from 'discord.js';

// Globale opslag voor actieve afmeldingen in het geheugen
if (!global.activeAbsences) {
    global.activeAbsences = new Map();
}

const ABSENT_ROLE_ID = '1531246008925945946';

// Hulpfunctie om datum (DD-MM-YYYY of DD/MM/YYYY) om te zetten naar een Date object
function parseDutchDate(dateStr) {
    try {
        const clean = dateStr.trim().replace(/\//g, '-');
        const parts = clean.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const d = new Date(year, month, day, 23, 59, 59); // Eind van de dag
            return isNaN(d.getTime()) ? null : d;
        }
    } catch (e) {
        return null;
    }
    return null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('absent')
        .setDescription('Meld jezelf afwezig voor een specifieke periode'),

    async execute(interaction) {
        try {
            const modalCustomId = `absent_modal_${interaction.id}`;

            // 1. POP-UP (MODAL) BOUWEN
            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('💤 Afwezigheid Doorgeven');

            const nameInput = new TextInputBuilder()
                .setCustomId('absent_name')
                .setLabel('👤 Jouw In-Game / Karakter Naam')
                .setPlaceholder('bijv. Jan de Boer / Appie')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const startDateInput = new TextInputBuilder()
                .setCustomId('absent_start')
                .setLabel('📅 Vanaf wanneer afwezig?')
                .setPlaceholder('bijv. 28-07-2026')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const endDateInput = new TextInputBuilder()
                .setCustomId('absent_end')
                .setLabel('📅 Tot en met wanneer afwezig?')
                .setPlaceholder('bijv. 02-08-2026')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('absent_reason')
                .setLabel('📝 Reden van afwezigheid')
                .setPlaceholder('bijv. Op vakantie naar Spanje / Druk met school')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(startDateInput),
                new ActionRowBuilder().addComponents(endDateInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            // 2. POP-UP TONEN
            await interaction.showModal(modal);

            // 3. WACHTEN OP VERSTUREN (MAX 10 MINUTEN)
            const submitted = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === modalCustomId && i.user.id === interaction.user.id,
                time: 600000
            }).catch(() => null);

            if (!submitted) return;

            const name = submitted.fields.getTextInputValue('absent_name');
            const startDateStr = submitted.fields.getTextInputValue('absent_start');
            const endDateStr = submitted.fields.getTextInputValue('absent_end');
            const reason = submitted.fields.getTextInputValue('absent_reason');

            const endDate = parseDutchDate(endDateStr);

            // 4. AUTOMATISCH DE AFWEZIG ROL TOEWYSEN
            let roleAdded = false;
            try {
                const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                if (member) {
                    await member.roles.add(ABSENT_ROLE_ID).catch((e) => {
                        console.warn('⚠️ Kon afwezig rol niet toevoegen:', e.message);
                    });
                    roleAdded = true;
                }
            } catch (err) {
                console.warn('⚠️ Fout bij ophalen member voor rol:', err.message);
            }

            // 5. STUUR EMBED NAAR #💤〢absent KANAAL
            const absentChannel = interaction.guild.channels.cache.find(c => 
                c.name === '💤〢absent' || 
                c.name === 'absent' || 
                c.name.includes('absent') ||
                c.name.includes('afwezig')
            );

            const absentEmbed = new EmbedBuilder()
                .setTitle(`💤 Nieuwe Afmelding • ${name}`)
                .setColor('#FF9900') // Oranje voor actief afwezig
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `>>> **👤 Gebruiker:** <@${interaction.user.id}>\n` +
                    `**📛 Naam:** \`${name}\`\n` +
                    `**🟢 Status:** \`🟢 Actief Afwezig\`\n` +
                    `**📅 Periode:** \`${startDateStr}\` **t/m** \`${endDateStr}\`\n\n` +
                    `**📝 Reden:**\n> ${reason.replace(/\n/g, '\n> ')}`
                )
                .setFooter({
                    text: `Afgemeld door ${interaction.user.username} • Nexus Community`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            let targetMessage = null;
            if (absentChannel) {
                targetMessage = await absentChannel.send({ embeds: [absentEmbed] }).catch(() => null);
            } else {
                targetMessage = await interaction.channel.send({ embeds: [absentEmbed] }).catch(() => null);
            }

            // 6. SLA AFMELDING OP IN HET GEHEUGEN VOOR DE AUTOMATISCHE CHECKER
            global.activeAbsences.set(interaction.user.id, {
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 dagen als datum onleesbaar was
                messageId: targetMessage ? targetMessage.id : null,
                channelId: targetMessage ? targetMessage.channel.id : null,
                name: name,
                startDateStr: startDateStr,
                endDateStr: endDateStr,
                reason: reason
            });

            // 7. BEVESTIGING VOOR DE GEBRUIKER
            await submitted.reply({
                content: `✅ **Afmelding succesvol doorgegeven!**\nDe afwezigheidsrol <@&${ABSENT_ROLE_ID}> is aan je toegewezen. Je afmelding staat in ${absentChannel || 'het afwezigheidskanaal'}.`,
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /absent:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Er ging iets mis bij het openen van het afmeldingsformulier.',
                    ephemeral: true
                }).catch(() => null);
            }
        }
    }
};

