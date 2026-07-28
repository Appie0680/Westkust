import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('wordsnake')
        .setDescription('Bekijk de status van de Woordenslang game of reset het spel')
        .addStringOption(option =>
            option.setName('actie')
                .setDescription('Kies een actie')
                .setRequired(false)
                .addChoices(
                    { name: 'Status & Regels bekijken', value: 'status' },
                    { name: '🔄 Reset de Woordenslang (Beheer)', value: 'reset' }
                )
        ),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('actie') || 'status';
            const state = global.wordSnakeState || {
                currentWord: 'slang',
                lastLetter: 'g',
                lastUserId: null,
                usedWords: new Set(['slang']),
                snakeLength: 1,
                highScore: 1
            };

            // RESET OPTIE (Alleen voor Beheerders)
            if (action === 'reset') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    return interaction.reply({
                        content: '❌ Alleen beheerders kunnen de Woordenslang resetten.',
                        ephemeral: true
                    });
                }

                global.wordSnakeState = {
                    currentWord: 'nexus',
                    lastLetter: 's',
                    lastUserId: null,
                    usedWords: new Set(['nexus']),
                    snakeLength: 1,
                    highScore: state.highScore || 1
                };

                const resetEmbed = new EmbedBuilder()
                    .setTitle('🔄 Woordenslang Gereset!')
                    .setDescription(
                        `De Woordenslang is gereset door <@${interaction.user.id}>.\n\n` +
                        `🏁 **Nieuw beginwoord:** \`nexus\`\n` +
                        `👉 **Volgende letter:** **\`S\`**`
                    )
                    .setColor('#FF3366');

                return interaction.reply({ embeds: [resetEmbed] });
            }

            // STATUS & REGELS OPTIE
            const statusEmbed = new EmbedBuilder()
                .setTitle('🐍 Nexus Woordenslang (Word Snake)')
                .setColor('#00F0FF')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription(
                    `>>> **Huidig Woord:** \`${state.currentWord.toUpperCase()}\`\n` +
                    `👉 **Volgende Beginletter:** **\`${state.lastLetter.toUpperCase()}\`**\n` +
                    `📏 **Huidige Lengte:** \`${state.snakeLength} woorden\`\n` +
                    `🏆 **All-Time Record:** \`${state.highScore} woorden\``
                )
                .addFields(
                    {
                        name: '📜 **Spelregels (Game Rules)**',
                        value: 
                            `• **NL & EN:** Woorden in het Nederlands & Engels zijn toegestaan.\n` +
                            `• **Koppelregel:** Je woord moet beginnen met de **laatste letter** van het vorige woord.\n` +
                            `• **Min. Lengte:** Elk woord moet minstens **3 letters** lang zijn.\n` +
                            `• **Afwisselen:** Je mag **niet 2 keer achter elkaar** een woord leggen.\n` +
                            `• **Geen Herhaling:** Elk woord mag maar **1x** in de slang voorkomen.`
                    }
                )
                .setFooter({
                    text: 'Speel mee in #🐍〢word-snake!',
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            return interaction.reply({ embeds: [statusEmbed] });

        } catch (error) {
            console.error('❌ Fout bij /wordsnake:', error);
            return interaction.reply({
                content: '❌ Er ging iets mis bij het ophalen van de Woordenslang status.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

