import { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} from 'discord.js';

async function resetWalletBalance(client, userId) {
    if (!client.wallets) client.wallets = new Map();
    client.wallets.set(userId, 0);

    if (client.db) {
        try {
            await client.db.query(`
                CREATE TABLE IF NOT EXISTS user_wallets (
                    user_id VARCHAR(32) PRIMARY KEY,
                    balance NUMERIC(12, 2) DEFAULT 0
                );
            `).catch(() => null);

            await client.db.query('UPDATE user_wallets SET balance = 0 WHERE user_id = $1', [userId]).catch(() => null);
        } catch (e) {
            // DB optioneel
        }
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('resetsaldo')
        .setDescription('Reset het Nexus Portemonnee saldo van een gebruiker naar €0,00')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker waarvan je het saldo wilt resetten')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('gebruiker');
            const modalCustomId = `resetsaldo_modal_${interaction.id}`;

            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle('⚠️ Saldo Reset Beveiliging');

            const passwordInput = new TextInputBuilder()
                .setCustomId('beheer_password')
                .setLabel('Vul het beheerder wachtwoord in:')
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

            // Reset uitvoeren in geheugen & DB
            await resetWalletBalance(interaction.client, targetUser.id);

            await submitted.reply({
                content: `🔄 **Saldo Gereset!** Het saldo van <@${targetUser.id}> is succesvol teruggezet naar **€ 0,00**.`,
                ephemeral: true
            });

            // LOGGING SYSTEEM IN UITSLUITEND #🎞️〢saldo-loggs
            const logChannel = interaction.guild.channels.cache.find(c => 
                c.name === '🎞️〢saldo-loggs' ||
                c.name === 'saldo-loggs' ||
                (c.name.includes('saldo') && c.name.includes('loggs'))
            );

            if (logChannel) {
                const timestamp = Math.floor(Date.now() / 1000);
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔄 Saldo Gereset')
                    .setColor('#FF3366') // Bright Crimson Red
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `>>> **👤 Gebruiker Gereset:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
                        `**🛡️ Beheerder:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n` +
                        `**📉 Nieuw Saldo:** \`€ 0,00\`\n` +
                        `**⏰ Datum & Tijd:** <t:${timestamp}:F>`
                    )
                    .setFooter({ text: 'Nexus Saldo Logging System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
            }

        } catch (error) {
            console.error('❌ Fout bij /resetsaldo:', error);
        }
    }
};

