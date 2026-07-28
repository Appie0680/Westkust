import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('partnerlog')
        .setDescription('Plaats het live Partner Leaderboard met uitbetalingskeuze (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            if (!global.userPartnerCounts) global.userPartnerCounts = new Map();
            if (!global.userPayoutChoices) global.userPayoutChoices = new Map();

            if (!global.payoutMethods) {
                global.payoutMethods = new Map([
                    ['robux', { name: 'Robux', rate: 10, target: 800, unit: 'Robux' }],
                    ['springbank', { name: 'Springbank Coins', rate: 83, target: 500, unit: 'Coins' }],
                    ['geld', { name: 'Geld (€)', rate: 0.12, target: 10.00, unit: '€' }]
                ]);
            }

            // Leaderboard opbouwen
            let leaderboardText = '';
            if (global.userPartnerCounts.size === 0) {
                leaderboardText = '*Nog geen actieve partners geregistreerd. Plaats een link in partners om te beginnen!*';
            } else {
                const sorted = Array.from(global.userPartnerCounts.entries()).sort((a, b) => b[1] - a[1]);
                let rank = 1;
                for (const [userId, count] of sorted) {
                    const choiceKey = global.userPayoutChoices.get(userId) || 'robux';
                    const method = global.payoutMethods.get(choiceKey) || global.payoutMethods.get('robux');
                    
                    const earned = count * method.rate;
                    const targetText = method.unit === '€' 
                        ? `€${earned.toFixed(2)} / €${method.target.toFixed(2)}` 
                        : `${earned} / ${method.target} ${method.unit}`;

                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '👤';
                    leaderboardText += `${medal} <@${userId}> — **${count} partners** (\`${targetText}\` • ${method.name})\n`;
                    rank++;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('📊 Nexus Partner Leaderboard & Uitbetalingen')
                .setColor('#00F0FF')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription(
                    `Hieronder zie je de actieve uitbetalingsvoortgang van ons marketing team!\n\n` +
                    `**📜 Uitbetalingsschema:**\n` +
                    `• 🪙 **Robux:** 10 Robux / partner (Doel: 800 Robux)\n` +
                    `• 🪙 **Springbank Coins:** 83 Coins / partner (Doel: 500 Coins)\n` +
                    `• 💶 **Geld:** €0,12 / partner (Doel: €10,00)\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🏆 **Huidige Stand:**\n${leaderboardText}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                )
                .setFooter({ text: 'Selecteer hieronder jouw gewenste uitbetalingsmethode!' })
                .setTimestamp();

            // Options voor dropdown bouwen
            const options = [];
            for (const [key, m] of global.payoutMethods) {
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(m.name)
                        .setValue(key)
                        .setDescription(`${m.rate} ${m.unit} per partner (Doel: ${m.target} ${m.unit})`)
                );
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_payout_method')
                .setPlaceholder('Kies jouw uitbetalingsmethode...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            // Stuur het bord naar het kanaal
            const newMsg = await interaction.channel.send({ embeds: [embed], components: [row] });
            global.partnerLeaderboardMessageId = newMsg.id;

            return interaction.reply({
                content: '✅ **Partner Leaderboard succesvol geplaatst in dit kanaal!** Vanaf nu wordt dit bericht automatisch geüpdatet.',
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /partnerlog:', error);
            return interaction.reply({ content: '❌ Er ging iets mis bij het aanmaken van de partner log.', ephemeral: true }).catch(() => null);
        }
    }
};

