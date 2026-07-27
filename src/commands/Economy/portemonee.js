import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('portemonnee')
        .setDescription('Bekijk het Nexus Portemonnee saldo van jezelf of een ander')
        .addUserOption(option =>
            option.setName('gebruiker')
                .setDescription('De gebruiker waarvan je de portemonnee wilt inzien')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('gebruiker') || interaction.user;
            
            // Haal het saldo op uit de bot-database (of 0 als er niks is)
            let currentBalance = 0;
            if (interaction.client.db) {
                try {
                    const result = await interaction.client.db.query(
                        'SELECT balance FROM user_wallets WHERE user_id = $1',
                        [targetUser.id]
                    );
                    if (result && result.rows && result.rows.length > 0) {
                        currentBalance = parseFloat(result.rows[0].balance) || 0;
                    }
                } catch (dbErr) {
                    // Mocht de tabel nog niet bestaan of DB offline zijn
                    console.warn('⚠️ Kon saldo niet ophalen uit DB:', dbErr.message);
                }
            }

            // Bouw de "zieke" Nexus Portemonnee Pop-up / Embed
            const walletEmbed = new EmbedBuilder()
                .setTitle(`👛 Nexus Portemonnee • ${targetUser.username}`)
                .setColor('#00F0FF') // Cyberpunk Cyan
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `💳 **Eigenaar:** <@${targetUser.id}>\n` +
                    `🏦 **Nexus Status:** \`Actief Account\`\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                )
                .addFields(
                    {
                        name: '💰 **Huidig Saldo**',
                        value: `\`\`\`fix\n€ ${currentBalance.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Nexus Wallet System • Beheerd door Beheer',
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [walletEmbed]
            });

        } catch (error) {
            console.error('❌ Fout bij /portemonnee:', error);
            return interaction.reply({
                content: '❌ Er is een fout opgetreden bij het inzien van de portemonnee.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

