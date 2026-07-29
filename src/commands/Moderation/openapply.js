import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('openapply')
        .setDescription('Plaats het sollicitatiepaneel in een gekozen kanaal (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanaal')
                .setDescription('Het kanaal waar het sollicitatiepaneel geplaatst moet worden')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('kanaal');

            if (!targetChannel.isTextBased()) {
                return interaction.reply({
                    content: '❌ Selecteer een tekstkanaal!',
                    ephemeral: true
                });
            }

            const applyEmbed = new EmbedBuilder()
                .setTitle('💼 Nexus Community • Sollicitatie Marketing Team')
                .setColor('#00F0FF') // Cyberpunk Cyan
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription(
                    `>>> **Wil jij ons team versterken als Marketing Specialist?**\n\n` +
                    `Lijkt het jou leuk om partners te regelen, promotie te maken en onze server verder te laten groeien? Solliciteer dan direct!\n\n` +
                    `💬 **Hoe werkt het?**\n` +
                    `1. Klik hieronder op **\`📝 Solliciteer voor Marketing\`**.\n` +
                    `2. De bot stuurt jou een **DM** met de vragenlijst.\n` +
                    `3. Beantwoord de vragen rustig in DM en je sollicitatie wordt doorgestuurd naar ons Beheer!\n\n` +
                    `🟢 **Status:** \`OPEN\``
                )
                .setFooter({ 
                    text: 'Nexus Applications System • Klik op de knop om te starten', 
                    iconURL: interaction.guild.iconURL({ dynamic: true }) 
                })
                .setTimestamp();

            const applyButton = new ButtonBuilder()
                .setCustomId('start_marketing_application')
                .setLabel('📝 Solliciteer voor Marketing')
                .setStyle(ButtonStyle.Success);

            const toggleButton = new ButtonBuilder()
                .setCustomId('toggle_application_status')
                .setLabel('🔒 Sollicitaties Sluiten (Beheer)')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(applyButton, toggleButton);

            await targetChannel.send({ embeds: [applyEmbed], components: [row] });

            return interaction.reply({
                content: `✅ Sollicitatiepaneel succesvol geplaatst in <#${targetChannel.id}>!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /openapply:', error);
            return interaction.reply({
                content: '❌ Er ging iets mis bij het plaatsen van het sollicitatiepaneel.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

