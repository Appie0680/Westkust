import { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('resetsaldo')
        .setDescription('Reset het Nexus Portemonnee saldo van een gebruiker naar €0 (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker waarvan je het saldo wilt resetten')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('gebruiker');
            const modalCustomId = `resetsaldo_auth_${interaction.id}`;

            // Bouw het beveiligings-pop-up scherm
            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('⚠️ Saldo Reset Beveiliging');

            const passwordInput = new TextInputBuilder()
                .setCustomId('beheer_password')
                .setLabel('Vul het beheerder wachtwoord in om te resetten:')
                .setPlaceholder('Wachtwoord vereist...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(passwordInput));

            // Toon de pop-up
            await interaction.showModal(modal);

            const submitted = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === modalCustomId && i.user.id === interaction.user.id,
                time: 180000
            }).catch(() => null);

            if (!submitted) return;

            const enteredPassword = submitted.fields.getTextInputValue('beheer_password');

            // WACHTWOORD CHECK
            if (enteredPassword !== 'Nexus456!!') {
                return submitted.reply({
                    content: '❌ **Toegang Geweigerd!** Het ingevulde wachtwoord is onjuist.',
                    ephemeral: true
                });
            }

            // Reset in database
            if (interaction.client.db) {
                try {
                    await interaction.client.db.query(
                        'UPDATE user_wallets SET balance = 0 WHERE user_id = $1',
                        [targetUser.id]
                    );
                } catch (dbErr) {
                    console.error('⚠️ Database reset fout:', dbErr.message);
                }
            }

            // Bevestigingsbericht
            await submitted.reply({
                content: `🔄 **Saldo Gereset!** Het portemonnee saldo van <@${targetUser.id}> is succesvol teruggezet naar **€ 0,00**.`,
                ephemeral: true
            });

            // LOGGING SYSTEEM
            const logChannel = interaction.guild.channels.cache.find(c => 
                c.name === 'saldo-logs' || c.name === 'logs' || c.name === 'beheer-logs'
            );

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔄 Saldo Gereset (Log)')
                    .setColor('#FF0033')
                    .addFields(
                        { name: '👤 Gebruiker Gereset', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: '🛡️ Uitgevoerd door', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: '📉 Nieuw Saldo', value: '€ 0,00', inline: false }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
            }

        } catch (error) {
            console.error('❌ Fout bij /resetsaldo:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Er ging iets mis bij het resetten van het saldo.', ephemeral: true }).catch(() => null);
            }
        }
    }
};

