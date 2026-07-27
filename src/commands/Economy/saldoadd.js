import { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} from 'discord.js';

async function addWalletBalance(client, userId, amount) {
    if (!client.wallets) client.wallets = new Map();
    const current = client.wallets.get(userId) || 0;
    const newBalance = current + amount;
    
    client.wallets.set(userId, newBalance);

    if (client.db) {
        try {
            await client.db.query(`
                CREATE TABLE IF NOT EXISTS user_wallets (
                    user_id VARCHAR(32) PRIMARY KEY,
                    balance NUMERIC(12, 2) DEFAULT 0
                );
            `).catch(() => null);

            await client.db.query(`
                INSERT INTO user_wallets (user_id, balance)
                VALUES ($1, $2)
                ON CONFLICT (user_id) 
                DO UPDATE SET balance = user_wallets.balance + $2;
            `, [userId, amount]).catch(() => null);
        } catch (e) {
            // DB optioneel
        }
    }

    return newBalance;
}

export default {
    data: new SlashCommandBuilder()
        .setName('saldoadd')
        .setDescription('Voeg saldo toe aan de Nexus Portemonnee van een gebruiker')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker die het saldo ontvangt')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('bedrag')
                .setDescription('Het toe te voegen bedrag in euro\'s')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('gebruiker');
            const amount = interaction.options.getNumber('bedrag');

            if (amount <= 0) {
                return interaction.reply({
                    content: '❌ Het bedrag moet groter zijn dan €0,00.',
                    ephemeral: true
                });
            }

            const modalCustomId = `saldoadd_modal_${interaction.id}`;

            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('🔐 Nexus Beheer Authenticatie');

            const passwordInput = new TextInputBuilder()
                .setCustomId('beheer_password')
                .setLabel('Vul het geheime beheerder wachtwoord in:')
                .setPlaceholder('Wachtwoord vereist...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(passwordInput));

            await interaction.showModal(modal);

            const submitted = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === modalCustomId && i.user.id === interaction.user.id,
                time: 180000
            }).catch(() => null);

            if (!submitted) return;

            const enteredPassword = submitted.fields.getTextInputValue('beheer_password');

            if (enteredPassword !== 'Nexus456!!') {
                return submitted.reply({
                    content: '❌ **Toegang Geweigerd!** Onjuist wachtwoord ingevuld.',
                    ephemeral: true
                });
            }

            const newTotalBalance = await addWalletBalance(interaction.client, targetUser.id, amount);

            await submitted.reply({
                content: `✅ **Succesvol toegevoegd!**\n€ **${amount.toFixed(2)}** is toegevoegd aan de portemonnee van <@${targetUser.id}>.\nNieuw saldo: **€ ${newTotalBalance.toFixed(2)}**`,
                ephemeral: true
            });

            // LOGGING SYSTEEM IN UITSLUITEND #🎞️孪saldo-loggs
            const logChannel = interaction.guild.channels.cache.find(c => 
                c.name === '🎞️〢saldo-loggs' ||
                c.name === 'saldo-loggs' ||
                (c.name.includes('saldo') && c.name.includes('loggs'))
            );

            if (logChannel) {
                const timestamp = Math.floor(Date.now() / 1000);
                const logEmbed = new EmbedBuilder()
                    .setTitle('💸 Saldo Toegevoegd')
                    .setColor('#00FF88') // Neon Groen
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `>>> **👤 Ontvanger:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
                        `**🛡️ Beheerder:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n` +
                        `**💵 Toegevoegd:** \`+ € ${amount.toFixed(2)}\`\n` +
                        `**🏦 Nieuw Totaal Saldo:** \`€ ${newTotalBalance.toFixed(2)}\`\n` +
                        `**⏰ Datum & Tijd:** <t:${timestamp}:F>`
                    )
                    .setFooter({ text: 'Nexus Saldo Logging System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
            }

        } catch (error) {
            console.error('❌ Fout bij /saldoadd:', error);
        }
    }
};

