import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Hulpfunctie om saldo op te halen uit geheugen / DB
async function getWalletBalance(client, userId) {
    if (!client.wallets) client.wallets = new Map();
    
    if (client.wallets.has(userId)) {
        return client.wallets.get(userId);
    }

    if (client.db) {
        try {
            const res = await client.db.query('SELECT balance FROM user_wallets WHERE user_id = $1', [userId]);
            if (res && res.rows && res.rows.length > 0) {
                const bal = parseFloat(res.rows[0].balance) || 0;
                client.wallets.set(userId, bal);
                return bal;
            }
        } catch (e) {
            // DB optioneel
        }
    }
    
    return 0;
}

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
            const balance = await getWalletBalance(interaction.client, targetUser.id);

            // Strakke, mobielvriendelijke Nexus Embed
            const walletEmbed = new EmbedBuilder()
                .setTitle(`💳 Nexus Portemonnee`)
                .setColor('#00F0FF') // Bright Neon Cyan
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(
                    `>>> **Eigenaar:** <@${targetUser.id}>\n` +
                    `**Gebruikersnaam:** \`${targetUser.tag}\`\n` +
                    `**Status:** \`Nexus Account Actief\``
                )
                .addFields(
                    {
                        name: '💰 Huidig Saldo',
                        value: `\`\`\`yaml\n€ ${balance.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({
                    text: `Nexus Economy • Opgevraagd door ${interaction.user.username}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            return interaction.reply({ embeds: [walletEmbed] });

        } catch (error) {
            console.error('❌ Fout bij /portemonnee:', error);
            return interaction.reply({
                content: '❌ Er is een fout opgetreden bij het inzien van de portemonnee.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

