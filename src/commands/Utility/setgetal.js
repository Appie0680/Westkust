import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setgetal')
        .setDescription('Stel het geheime getal in voor Guess The Number (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('getal')
                .setDescription('Het geheime getal dat geraden moet worden')
                .setRequired(true)
                .setMinValue(1)
        )
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Selecteer een rol om te pingen bij het nieuwe getal (optioneel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const secretNum = interaction.options.getInteger('getal');
            const targetRole = interaction.options.getRole('rol');

            // Sla de status op in het globale geheugen
            global.guessNumberState = {
                secretNumber: secretNum,
                isGuessed: false,
                setByUserId: interaction.user.id,
                attempts: 0
            };

            // --- 1. BEVESTIGING VOOR DE BEHEERDER (ALLEEN VOOR JOU ZICHTBAAR) ---
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🎯 Geheim Getal Ingesteld!')
                .setColor('#00F0FF')
                .setDescription(`Het geheime getal is succesvol ingesteld op: **\`${secretNum}\`**\n\nNiemand anders kan dit zien!`)
                .setFooter({ text: 'Nexus Guess The Number' })
                .setTimestamp();

            await interaction.reply({
                embeds: [confirmEmbed],
                ephemeral: true
            });

            // --- 2. AANKONDIGING IN #🔔〢guess-the-number ---
            const guessChannel = interaction.guild.channels.cache.find(c => 
                c.name === '🔔〢guess-the-number' || 
                c.name === 'guess-the-number' || 
                c.name.includes('guess-the-number')
            );

            if (guessChannel) {
                const announcementEmbed = new EmbedBuilder()
                    .setTitle('🎲 Rara het Getal — Nieuwe Ronde!')
                    .setColor('#00FF88')
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setDescription(
                        `Er is een nieuw geheim getal ingesteld door <@${interaction.user.id}>!\n\n` +
                        `💬 **Hoe werkt het?**\n` +
                        `Typ simpelweg een getal in dit kanaal. De bot zal met **` +
                        `⬆️** of **⬇️** aangeven of het getal hoger of lager moet zijn!\n\n` +
                        `✨ *Veel succes met raden!*`
                    )
                    .setFooter({ text: 'Rara het Getal • Nexus Community' })
                    .setTimestamp();

                const pingText = targetRole ? `<@&${targetRole.id}>` : '';

                await guessChannel.send({
                    content: pingText || undefined,
                    embeds: [announcementEmbed]
                }).catch(() => null);
            }

        } catch (error) {
            console.error('❌ Fout bij /setgetal:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Er ging iets mis bij het instellen van het getal.',
                    ephemeral: true
                }).catch(() => null);
            }
        }
    }
};

