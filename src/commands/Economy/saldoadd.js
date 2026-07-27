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
        .setName('saldoadd')
        .setDescription('Voeg saldo toe aan de Nexus Portemonnee van een gebruiker (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker die saldo ontvangt')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('bedrag')
                .setDescription('Het toeyevoegen bedrag in euro\'s (bijv. 50 of 12.50)')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('gebruiker');
            const amount = interaction.options.getNumber('bedrag');

            if (amount <= 0) {
                return interaction.reply({
                    content: '❌ Het bedrag moet groter zijn dan 0.',
                    ephemeral: true
                });
            }

            const modalCustomId = `saldoadd_auth_${interaction.id}`;

            // Bouw het beveiligings-pop-up scherm
            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('🔐 Beheer Authenticatie');

            const passwordInput = new TextInputBuilder()
                .setCustomId('beheer_password')
                .setLabel('Vul het geheime beheerder wachtwoord in:')
                .setPlaceholder('Wachtwoord vereist...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(passwordInput));

            // Toon de pop-up aan de administrator
            await interaction.showModal(modal);

            // Wacht tot de beheerder het wachtwoord invult (max 3 minuten)
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

            // Saldo verwerken in database (of geheugen-fallback)
            let newBalance = amount;
            if (interaction.client.db) {
                try {
                    // Maak tabel aan als die nog niet bestaat
                    await interaction.client.db.query(`
                        CREATE TABLE IF NOT EXISTS user_wallets (
                            user_id VARCHAR(32) PRIMARY KEY,
                            balance NUMERIC(12, 2) DEFAULT 0
                        );
                    `).catch(() => null);

                    const queryText = `
                        INSERT INTO user_wallets (user_id, balance)
                        VALUES ($1, $2)
                        ON CONFLICT (user_id) 
                        DO UPDATE SET balance = user_wallets.balance + $2
                        RETURNING balance;
                    `;
                    const res = await interaction.client.db.query(queryText, [targetUser.id, amount]);
                    if (res && res.rows && res.rows[0]) {
                        newBalance = parseFloat(res.rows[0].balance);
                    }
                } catch (dbErr) {
                    console.error('⚠️ Database update fout:', dbErr.message);
                }
            }

            // Bevestigingsbericht
            await submitted.reply({
                content: `✅ **Succesvol toegevoegd!**\n€ **${amount.toFixed(2)}** is toegevoegd aan de portemonnee van <@${targetUser.id}>.\nNieuw saldo: **€ ${newBalance.toFixed(2)}**`,
                ephemeral: true
            });

            // LOGGING SYSTEEM
            const logChannel = interaction.guild.channels.cache.find(c => 
                c.name === 'saldo-logs' || c.name === 'logs' || c.name === 'beheer-logs'
            );

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('💳 Saldo Toegevoegd (Log)')
                    .setColor('#00FF66')
                    .addFields(
                        { name: '👤 Ontvanger', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: '🛡️ Uitgevoerd door', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: '💵 Bedrag Toegevoegd', value: `+ € ${amount.toFixed(2)}`, inline: false },
                        { name: '🏦 Nieuw Saldo', value: `€ ${newBalance.toFixed(2)}`, inline: false }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
            }

        } catch (error) {
            console.error('❌ Fout bij /saldoadd:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Er ging iets mis bij het toevoegen van het saldo.', ephemeral: true }).catch(() => null);
            }
        }
    }
};

