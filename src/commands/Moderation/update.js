import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ChannelType
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Open het update-menu om een strakke aankondiging te maken')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option =>
            option.setName('kanaal')
                .setDescription('Kanaal waar de update moet komen (standaard: dit kanaal)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('ping')
                .setDescription('Wilt u een rol of iedereen pingen?')
                .setRequired(false)
                .addChoices(
                    { name: 'Geen Ping', value: 'none' },
                    { name: '@everyone', value: 'everyone' },
                    { name: '@here', value: 'here' }
                )
        ),

    async execute(interaction) {
        try {
            // Uniek ID genereren voor deze specifieke modal interactie
            const modalCustomId = `update_modal_${interaction.id}`;

            // --- 1. POP-UP (MODAL) BOUWEN ---
            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('🚀 Plaats een Nieuwe Update');

            // Veld 1: Titel / Versie
            const titleInput = new TextInputBuilder()
                .setCustomId('update_title')
                .setLabel('📌 Titel / Versienummer')
                .setPlaceholder('bijv: Patch v2.4 - Grote Bugfixes & Performance')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true);

            // Veld 2: Categorie / Type
            const categoryInput = new TextInputBuilder()
                .setCustomId('update_category')
                .setLabel('🏷️ Categorie')
                .setPlaceholder('bijv: Server Update / Bot Fixes / Nieuwe Features')
                .setStyle(TextInputStyle.Short)
                .setValue('Bot & Server Update')
                .setMaxLength(50)
                .setRequired(true);

            // Veld 3: Wat is er gedaan?
            const changesInput = new TextInputBuilder()
                .setCustomId('update_changes')
                .setLabel('🛠️ Wat is er aangepast/gedaan?')
                .setPlaceholder('- Alle crashes opgelost\n- Nieuw /update commando toegevoegd met pop-up\n- Snelheid met 40% verbeterd')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            // Veld 4: Belangrijke opmerkingen / Highlights (Optioneel)
            const highlightsInput = new TextInputBuilder()
                .setCustomId('update_highlights')
                .setLabel('⭐ Belangrijke Mededeling / Opmerkingen')
                .setPlaceholder('bijv: Herstart je Discord client even met CTRL + R om de nieuwe knoppen te zien!')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            // Rijen toevoegen aan modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(categoryInput),
                new ActionRowBuilder().addComponents(changesInput),
                new ActionRowBuilder().addComponents(highlightsInput)
            );

            // --- 2. POP-UP TONEN AAN DE GEBRUIKER ---
            await interaction.showModal(modal);

            // --- 3. WACHTEN OP HET INVULLEN VAN DE POP-UP (MAX 10 MINUTEN) ---
            const submitted = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === modalCustomId && i.user.id === interaction.user.id,
                time: 600000
            }).catch(() => null);

            // Als de gebruiker het venster heeft weggeklikt of niet op tijd heeft verstuurd
            if (!submitted) return;

            // --- 4. DATA OPHALEN UIT HET VERSTUURDE FORMULIER ---
            const title = submitted.fields.getTextInputValue('update_title');
            const category = submitted.fields.getTextInputValue('update_category');
            const changes = submitted.fields.getTextInputValue('update_changes');
            const highlights = submitted.fields.getTextInputValue('update_highlights');

            const targetChannel = interaction.options.getChannel('kanaal') || interaction.channel;
            const pingOption = interaction.options.getString('ping') || 'none';

            // Bepaal de ping tekst
            let pingContent = '';
            if (pingOption === 'everyone') pingContent = '@everyone';
            if (pingOption === 'here') pingContent = '@here';

            // --- 5. HET "ZIEKE DESIGN" EMBED BOUWEN ---
            const updateEmbed = new EmbedBuilder()
                .setColor('#00F0FF') // Neon Cyan Cyberpunk Look
                .setAuthor({
                    name: `${interaction.guild.name} • Officieel Bericht`,
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || interaction.user.displayAvatarURL()
                })
                .setTitle(`✨ ${title}`)
                .setDescription(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**🏷️ Categorie:** \`${category}\`\n**📅 Datum:** <t:${Math.floor(Date.now() / 1000)}:F>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    {
                        name: '🛠️ **Uitgevoerde Wijzigingen & Verbeteringen**',
                        value: changes.length > 1024 ? changes.substring(0, 1020) + '...' : changes,
                        inline: false
                    }
                );

            // Als er highlights/extra info is ingevuld, voeg een extra mooi blok toe
            if (highlights && highlights.trim().length > 0) {
                updateEmbed.addFields({
                    name: '💡 **Belangrijke Opmerking**',
                    value: `> ${highlights.replace(/\n/g, '\n> ')}`,
                    inline: false
                });
            }

            updateEmbed
                .setFooter({
                    text: `Gepubliceerd door ${interaction.user.tag} • TitanBot`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            // --- 6. HET BERICHT VERSTUREN NAAR HET DOELKANAAL ---
            await targetChannel.send({
                content: pingContent || undefined,
                embeds: [updateEmbed]
            });

            // --- 7. BEVESTIGING IN DE POP-UP RESPONS ---
            await submitted.reply({
                content: `✅ **Update succesvol geplaatst!** Bekijk het bericht in ${targetChannel}.`,
                ephemeral: true
            });

        } catch (error) {
          console.error('❌ Fout bij verwerken van update modal:', error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Er ging iets mis bij het versturen van de update.', ephemeral: true }).catch(() => null);
          } else {
            await interaction.reply({ content: '❌ Er ging iets mis bij het openen van de update pop-up.', ephemeral: true }).catch(() => null);
          }
        }
    }
};

