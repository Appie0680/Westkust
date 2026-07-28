import { Events, EmbedBuilder } from 'discord.js';

// Globale Geheugenopslag
if (!global.wordSnakeState) {
    global.wordSnakeState = {
        currentWord: 'slang',
        lastLetter: 'g',
        lastUserId: null,
        usedWords: new Set(['slang']),
        snakeLength: 1,
        highScore: 1
    };
}

if (!global.countingState) {
    global.countingState = {
        currentCount: 0,
        lastUserId: null,
        highScore: 0
    };
}

if (!global.guessNumberState) {
    global.guessNumberState = {
        secretNumber: null,
        isGuessed: true,
        setByUserId: null,
        attempts: 0
    };
}

// Opslag voor de sticky message ID
if (!global.partnerStickyMessageId) {
    global.partnerStickyMessageId = null;
}

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const channelName = message.channel.name.toLowerCase();

        // ==========================================================
        // FEATURE: STICKY MESSAGE IN PARTNER KANAAL (#🍀〢partners)
        // ==========================================================
        const isPartnerChannel = 
            channelName === '🍀〢partners' ||
            channelName === 'partners' ||
            channelName.includes('partners');

        if (isPartnerChannel) {
            try {
                // Verwijder het vorige sticky bericht als dat er nog staat
                if (global.partnerStickyMessageId) {
                    const oldSticky = await message.channel.messages.fetch(global.partnerStickyMessageId).catch(() => null);
                    if (oldSticky) {
                        await oldSticky.delete().catch(() => null);
                    }
                }

                // De inhoud van de sticky message
                const stickyText = `# We are against Scam, negative and leak servers. So we don't partner with this either`;

                // Stuur het nieuwe sticky bericht direct onder het nieuw geplaatste partnerbericht
                const newSticky = await message.channel.send({ content: stickyText });
                
                // Sla de ID op voor de volgende keer
                global.partnerStickyMessageId = newSticky.id;

            } catch (err) {
                console.error('❌ Fout bij verwerken partner sticky message:', err);
            }

            return; // Beëindig uitvoering voor partnerkanaal
        }

        // ==========================================================
        // GAME 1: GUESS THE NUMBER (#🔔〢guess-the-number)
        // ==========================================================
        const isGuessChannel = 
            channelName === '🔔〢guess-the-number' ||
            channelName === 'guess-the-number' ||
            channelName.includes('guess-the-number');

        if (isGuessChannel) {
            const guessState = global.guessNumberState;
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

            guessState.attempts += 1;

            if (guessedNumber < guessState.secretNumber) {
                await message.react('⬆️').catch(() => null);
                const reply = await message.reply(`⬆️ **Hoger!** Het gezochte getal is groter dan **${guessedNumber}**.`).catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                }, 5000);
                return;
            }

            if (guessedNumber > guessState.secretNumber) {
                await message.react('⬇️').catch(() => null);
                const reply = await message.reply(`⬇️ **Lager!** Het gezochte getal is kleiner dan **${guessedNumber}**.`).catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                }, 5000);
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
            const countState = global.countingState;
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

            if (countState.currentCount > countState.highScore) {
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
            const state = global.wordSnakeState;
            const inputWord = message.content.trim().toLowerCase();

            if (inputWord.startsWith('/') || inputWord.startsWith('!')) return;

            const wordRegex = /^[a-zA-Záéíóúnñçäëïöü-]+$/;
            if (!wordRegex.test(inputWord) || inputWord.includes(' ')) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('⚠️ **Geen geldig woord!** Stuur enkel één enkel woord.').catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            if (inputWord.length < 3) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('⚠️ **Te kort!** Een woord moet minstens 3 letters lang zijn.').catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            if (state.lastUserId === message.author.id) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply('🚫 **Niet zo snel!** Laat eerst iemand anders een woord leggen.').catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            const firstLetter = inputWord.charAt(0);
            if (firstLetter !== state.lastLetter) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply(`❌ **Foute beginletter!** Het woord moet beginnen met **\`${state.lastLetter.toUpperCase()}\`** (van *${state.currentWord}*).`).catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            if (state.usedWords.has(inputWord)) {
                await message.react('❌').catch(() => null);
                const reply = await message.reply(`⚠️ **Al gebruikt!** Het woord **\`${inputWord}\`** is al eerder gelegd.`).catch(() => null);
                setTimeout(() => {
                    reply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            state.usedWords.add(inputWord);
            state.currentWord = inputWord;
            state.lastLetter = inputWord.slice(-1);
            state.lastUserId = message.author.id;
            state.snakeLength += 1;

            if (state.snakeLength > state.highScore) {
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

