import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('count')
        .setDescription('Bekijk de huidige stand van het telsysteem of reset de telling')
        .addStringOption(option =>
            option.setName('actie')
                .setDescription('Kies een actie')
                .setRequired(false)
                .addChoices(
                    { name: '📊 Stand Bekijken', value: 'status' },
                    { name: '🔄 Reset Telling (Beheer)', value: 'reset' }
                )
        ),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('actie') || 'status';
            const state = global.countingState || { currentCount: 0, highScore: 0 };

            if (action === 'reset') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    return interaction.reply({
                        content: '❌ Alleen beheerders kunnen de telling resetten.',
                        ephemeral: true
                    });
                }

                global.countingState = {
                    currentCount: 0,
                    lastUserId: null,
                    highScore: state.highScore || 0
                };

                return interaction.reply({
                    content: '🔄 **Telling is handmatig teruggezet naar 0!** Het volgende getal is **1**.',
                    ephemeral: false
                });
            }

            const countEmbed = new EmbedBuilder()
                .setTitle('🔢 Nexus Telsysteem Status')
                .setColor('#00F0FF')
                .setDescription(
                    `>>> **Huidige Stand:** \`${state.currentCount}\`\n` +
                    `👉 **Volgende Getal:** \`${state.currentCount + 1}\`\n` +
                    `🏆 **Hoogste Record:** \`${state.highScore}\``
                )
                .setFooter({ text: 'Tel mee in #🔢〢count!' })
                .setTimestamp();

            return interaction.reply({ embeds: [countEmbed] });

        } catch (error) {
            console.error('❌ Fout bij /count:', error);
            return interaction.reply({ content: '❌ Er ging iets mis.', ephemeral: true }).catch(() => null);
        }
    }
};

