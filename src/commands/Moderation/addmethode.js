import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

if (!global.payoutMethods) {
    global.payoutMethods = new Map([
        ['robux', { name: 'Robux', rate: 10, target: 800, unit: 'Robux' }],
        ['springbank', { name: 'Springbank Coins', rate: 83, target: 500, unit: 'Coins' }],
        ['geld', { name: 'Geld (€)', rate: 0.12, target: 10.00, unit: '€' }]
    ]);
}

export default {
    data: new SlashCommandBuilder()
        .setName('addmethode')
        .setDescription('Voeg een nieuwe uitbetalingsmethode toe voor het partner team (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('naam')
                .setDescription('Naam van de methode (bijv. Westkust Coins)')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('waarde_per_partner')
                .setDescription('Hoeveelheid coins/geld per partner (bijv. 50 of 0.15)')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('doel')
                .setDescription('Het doel waarbij gereset wordt en Swipe DM melding komt (bijv. 1000)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('eenheid')
                .setDescription('Eenheid (bijv. Coins, Robux, €)')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const name = interaction.options.getString('naam');
            const rate = interaction.options.getNumber('waarde_per_partner');
            const target = interaction.options.getNumber('doel');
            const unit = interaction.options.getString('eenheid');

            const key = name.toLowerCase().replace(/\s+/g, '_');
            global.payoutMethods.set(key, { name, rate, target, unit });

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Nieuwe Uitbetalingsmethode Toegevoegd!')
                .setColor('#00FF88')
                .setDescription(
                    `>>> **Methode:** \`${name}\`\n` +
                    `**Waarde per partner:** \`${rate} ${unit}\`\n` +
                    `**Uitbetalingsdoel:** \`${target} ${unit}\``
                )
                .setFooter({ text: 'Nexus Marketing System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Fout bij /addmethode:', error);
            return interaction.reply({ content: '❌ Er ging iets mis.', ephemeral: true }).catch(() => null);
        }
    }
};

