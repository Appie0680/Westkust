import { 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder 
} from 'discord.js';

// --- GLOBALE DATA STORES ---
if (!global.loggedPartnerLinks) global.loggedPartnerLinks = new Set();
if (!global.userPartnerCounts) global.userPartnerCounts = new Map();
if (!global.userPayoutChoices) global.userPayoutChoices = new Map();
if (!global.partnerLeaderboardMessageId) global.partnerLeaderboardMessageId = null;

if (!global.payoutMethods) {
    global.payoutMethods = new Map([
        ['robux', { name: 'Robux', rate: 10, target: 800, unit: 'Robux' }],
        ['springbank', { name: 'Springbank Coins', rate: 83, target: 500, unit: 'Coins' }],
        ['geld', { name: 'Geld (€)', rate: 0.12, target: 10.00, unit: '€' }]
    ]);
}

// Hulpfunctie om het leaderboard aan te maken/bij te werken in #📥〢partner-log
async function updatePartnerLeaderboard(client, guild) {
    try {
        const logChannel = guild.channels.cache.find(c => 
            c.name === '📥〢partner-log' || 
            c.name === 'partner-log' || 
            c.name.includes('partner-log')
        );

        if (!logChannel) return;

        // Leaderboard Beschrijving Opbouwen
        let leaderboardText = '';
        if (global.userPartnerCounts.size === 0) {
            leaderboardText = '*Er zijn nog geen partners geregistreerd.*';
        } else {
            const sorted = Array.from(global.userPartnerCounts.entries())
                .sort((a, b) => b[1] - a[1]);

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
            .setThumbnail(guild.iconURL({ dynamic: true }))
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

        // SelectMenu bouwen voor de uitbetalingskeuze
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

        // Bestaand bericht bijwerken of nieuw bericht sturen
        if (global.partnerLeaderboardMessageId) {
            const oldMsg = await logChannel.messages.fetch(global.partnerLeaderboardMessageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit({ embeds: [embed], components: [row] }).catch(() => null);
                return;
            }
        }

        const newMsg = await logChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
        if (newMsg) {
            global.partnerLeaderboardMessageId = newMsg.id;
        }

    } catch (err) {
        console.error('❌ Fout bij updatePartnerLeaderboard:', err);
    }
}

global.updatePartnerLeaderboard = updatePartnerLeaderboard;

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const channelName = message.channel.name.toLowerCase();

        // ==========================================================
        // FEATURE: PARTNER SYSTEM IN #🍀〢partners
        // ==========================================================
        const isPartnerChannel = 
            channelName === '🍀〢partners' ||
            channelName === 'partners' ||
            channelName.includes('partners');

        if (isPartnerChannel) {
            // Regex om Discord invite links te herkennen
            const discordInviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.me|discordapp\.com\/invite|discord\.com\/invite)\/([a-zA-Z0-0-]{2,32})/gi;
            const matches = message.content.match(discordInviteRegex);

            // Alleen verwerken als er DAADWERKELIJK een invite link in staat
            if (matches && matches.length > 0) {
                const inviteLink = matches[0].toLowerCase();

                // DUBBELE LINK CHECK: Mag niet 2x geplaatst worden
                if (global.loggedPartnerLinks.has(inviteLink)) {
                    await message.react('❌').catch(() => null);
                    const reply = await message.reply('⚠️ Deze partner-link is al eerder ingestuurd en telt niet dubbel mee!').catch(() => null);
                    setTimeout(() => {
                        reply?.delete().catch(() => null);
                    }, 5000);
                    return;
                }

                // Sla de link op als verwerkt
                global.loggedPartnerLinks.add(inviteLink);
                await message.react('✅').catch(() => null);

                // +1 Partner tellen voor de gebruiker
                const currentCount = (global.userPartnerCounts.get(message.author.id) || 0) + 1;
                global.userPartnerCounts.set(message.author.id, currentCount);

                // Bepaal de gekozen uitbetalingsmethode van deze gebruiker
                const choiceKey = global.userPayoutChoices.get(message.author.id) || 'robux';
                const method = global.payoutMethods.get(choiceKey) || global.payoutMethods.get('robux');

                const totalEarned = currentCount * method.rate;

                // CHECK OF HET DOEL IS BEREIKT!
                if (totalEarned >= method.target) {
                    // Tag de gebruiker & stuur Swipe DM Notificatie
                    const winEmbed = new EmbedBuilder()
                        .setTitle('🎉 UITBETALINGS DOEL BEHAALD!')
                        .setColor('#00FF88')
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setDescription(
                            `🏆 **Gefeliciteerd <@${message.author.id}>!**\n\n` +
                            `Je hebt jouw uitbetalingsdoel van **${method.target} ${method.unit}** (${method.name}) behaald!\n\n` +
                            `📩 **Je mag nu naar Swipe z'n DM voor je uitbetaling!**`
                        )
                        .setFooter({ text: 'Nexus Partner Payout System' })
                        .setTimestamp();

                    await message.channel.send({
                        content: `🎉 <@${message.author.id}> Je hebt het uitbetalingsdoel behaald! Je mag naar Swipe z'n DM voor je uitbetaling! 📩`,
                        embeds: [winEmbed]
                    }).catch(() => null);

                    // Reset de teller van deze gebruiker voor de volgende ronde
                    global.userPartnerCounts.set(message.author.id, 0);
                }

                // Update direct het live leaderboard
                await updatePartnerLeaderboard(client, message.guild);
            }

            // STICKY STATEMENT ONDERAAN HET KANAAL HOUDEN
            try {
                if (global.partnerStickyMessageId) {
                    const oldSticky = await message.channel.messages.fetch(global.partnerStickyMessageId).catch(() => null);
                    if (oldSticky) await oldSticky.delete().catch(() => null);
                }

                const stickyText = `# We are against Scam, negative and leak servers. So we don't partner with this either`;
                const newSticky = await message.channel.send({ content: stickyText });
                global.partnerStickyMessageId = newSticky.id;
            } catch (e) {
                // Ignore sticky error
            }

            return;
        }

        // ==========================================================
        // GAME 1: GUESS THE NUMBER (#🔔〢guess-the-number)
        // ==========================================================
        const isGuessChannel = 
            channelName === '🔔〢guess-the-number' ||
            channelName === 'guess-the-number' ||
            channelName.includes('guess-the-number');

        if (isGuessChannel) {
            const guessState = global.guessNumberState || {};
            const content = message.content.trim();

            if (content.startsWith('/') || content.startsWith('!')) return;

            const guessedNumber = parseInt(content, 10);
            if (isNaN(guessedNumber) || guessedNumber.toString() !== content) return;

            if (guessState.isGuessed || guessState.secretNumber === null) {
                const reply = await message.reply('⚠️ Er is momenteel geen actief geheim getal! Een beheerder moet eerst `/setgetal` uitvoeren.').catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            guessState.attempts = (guessState.attempts || 0) + 1;

            if (guessedNumber < guessState.secretNumber) {
                await message.react('⬆️').catch(() => null);
                const reply = await message.reply(`⬆️ **Hoger!** Het gezochte getal is groter dan **${guessedNumber}**.`).catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            if (guessedNumber > guessState.secretNumber) {
                await message.react('⬇️').catch(() => null);
                const reply = await message.reply(`⬇️ **Lager!** Het gezochte getal is kleiner dan **${guessedNumber}**.`).catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            if (guessedNumber === guessState.secretNumber) {
                guessState.isGuessed = true;
                await message.react('🎉').catch(() => null);

                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 GEWONNEN! GETAL GERADEN!')
                    .setColor('#00FF88')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `🏆 **Gefeliciteerd <@${message.author.id}>!**\n\n` +
                        `Je hebt het geheime getal **\`${guessState.secretNumber}\`** geraden in **${guessState.attempts} pogingen**!`
                    )
                    .setFooter({ text: 'Nexus Guess The Number Winner' })
                    .setTimestamp();

                await message.channel.send({
                    content: `🎉 Gefeliciteerd <@${message.author.id}>! Je hebt het getal geraden!`,
                    embeds: [winEmbed]
                }).catch(() => null);

                return;
            }
        }

        // ==========================================================
        // GAME 2: TELSYSTEME (#🔢〢count)
        // ==========================================================
        const isCountingChannel = 
            channelName === '🔢〢count' ||
            channelName === 'count' ||
            channelName.includes('count');

        if (isCountingChannel) {
            const countState = global.countingState || { currentCount: 0 };
            const content = message.content.trim();

            if (content.startsWith('/') || content.startsWith('!')) return;

            const inputNumber = parseInt(content, 10);
            if (isNaN(inputNumber) || inputNumber.toString() !== content) return;

            const expectedNumber = countState.currentCount + 1;

            if (countState.lastUserId === message.author.id) {
                await message.react('❌').catch(() => null);
                countState.currentCount = 0;
                countState.lastUserId = null;

                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Telling Gereset!')
                    .setDescription(`**<@${message.author.id}>** telde twee keer achter elkaar!\nDe telling begint weer bij **1**.`)
                    .setColor('#FF0033');

                await message.channel.send({ embeds: [failEmbed] }).catch(() => null);
                return;
            }

            if (inputNumber !== expectedNumber) {
                await message.react('❌').catch(() => null);
                countState.currentCount = 0;
                countState.lastUserId = null;

                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Fout Getal!')
                    .setDescription(`**<@${message.author.id}>** typte **${inputNumber}**, maar het verwachte getal was **${expectedNumber}**!\nDe telling is teruggezet naar **1**.`)
                    .setColor('#FF0033');

                await message.channel.send({ embeds: [failEmbed] }).catch(() => null);
                return;
            }

            countState.currentCount = expectedNumber;
            countState.lastUserId = message.author.id;

            if (countState.currentCount > (countState.highScore || 0)) {
                countState.highScore = countState.currentCount;
            }

            await message.react('✅').catch(() => null);

            if (countState.currentCount === 67) {
                await message.reply('**SIXSEVENNN 🗣️🔥**').catch(() => null);
            }

            if (countState.currentCount === 1000) {
                await message.react('🏆').catch(() => null);
                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 TELSYSTEME UITGESPEELD!')
                    .setDescription(`🏆 **Gefeliciteerd <@${message.author.id}>!**\n\nJe hebt het getal **1000** gehaald en het telsysteem compleet uitgespeeld! Legend! 🚀`)
                    .setColor('#00FF88')
                    .setTimestamp();

                await message.channel.send({
                    content: `🏆 Gefeliciteerd <@${message.author.id}>! Je hebt gewonnen, je hebt het uitgespeeld! 🎉`,
                    embeds: [winEmbed]
                }).catch(() => null);
            }

            return;
        }

        // ==========================================================
        // GAME 3: WOORDENSLANG (#🐍〢word-snake)
        // ==========================================================
        const isSnakeChannel = 
            channelName === '🐍〢word-snake' ||
            channelName === 'word-snake' ||
            channelName.includes('word-snake');

        if (isSnakeChannel) {
            const state = global.wordSnakeState || { currentWord: 'slang', lastLetter: 'g', usedWords: new Set(['slang']) };
            const inputWord = message.content.trim().toLowerCase();

            if (inputWord.startsWith('/') || inputWord.startsWith('!')) return;

            const wordRegex = /^[a-zA-Záéíóúnñçäëïöü-]+$/;
            if (!wordRegex.test(inputWord) || inputWord.includes(' ')) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('⚠️ **Geen geldig woord!** Stuur enkel één enkel woord.').catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            if (inputWord.length < 3) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('⚠️ **Te kort!** Een woord moet minstens 3 letters lang zijn.').catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            if (state.lastUserId === message.author.id) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('🚫 **Niet zo snel!** Laat eerst iemand anders een woord leggen.').catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            const firstLetter = inputWord.charAt(0);
            if (firstLetter !== state.lastLetter) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply(`❌ **Foute beginletter!** Het woord moet beginnen met **\`${state.lastLetter.toUpperCase()}\`** (van *${state.currentWord}*).`).catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            if (state.usedWords.has(inputWord)) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply(`⚠️ **Al gebruikt!** Het woord **\`${inputWord}\`** is al eerder gelegd.`).catch(() => null);
                setTimeout(() => reply?.delete().catch(() => null), 5000);
                return;
            }

            state.usedWords.add(inputWord);
            state.currentWord = inputWord;
            state.lastLetter = inputWord.slice(-1);
            state.lastUserId = message.author.id;
            state.snakeLength = (state.snakeLength || 0) + 1;

            if (state.snakeLength > (state.highScore || 0)) {
                state.highScore = state.snakeLength;
            }

            await message.react('✅').catch(() => null);

            if (state.snakeLength % 10 === 0) {
                await message.react('🐍').catch(() => null);
                const milestoneEmbed = new EmbedBuilder()
                    .setTitle('🎉 Mijlpaal Bereikt!')
                    .setDescription(`De Woordenslang is nu **${state.snakeLength} woorden** lang!\nHet huidige woord is: **\`${inputWord}\`** (volgende letter: **\`${state.lastLetter.toUpperCase()}\`**)`)
                    .setColor('#00FF88');
                
                await message.channel.send({ embeds: [milestoneEmbed] }).catch(() => null);
            }
        }
    }
};

