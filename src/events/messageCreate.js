import { Events, EmbedBuilder } from 'discord.js';

// Opslag voor Woordenslang in geheugen
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

// Opslag voor Telsysteem in geheugen
if (!global.countingState) {
    global.countingState = {
        currentCount: 0,
        lastUserId: null,
        highScore: 0
    };
}

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        // Sla botberichten en berichten buiten servers over
        if (message.author.bot || !message.guild) return;

        const channelName = message.channel.name.toLowerCase();

        // ==========================================================
        // SYSTEEM 1: TELSYSTEME (#🔢〢count)
        // ==========================================================
        const isCountingChannel = 
            channelName === '🔢〢count' ||
            channelName === 'count' ||
            channelName.includes('count');

        if (isCountingChannel) {
            const countState = global.countingState;
            const content = message.content.trim();

            // Sla commando's of niet-getallen over
            if (content.startsWith('/') || content.startsWith('!')) return;

            // Probeer de invoer om te zetten naar een geheel getal
            const inputNumber = parseInt(content, 10);

            // Als het geen getal is, negeer het of wis het
            if (isNaN(inputNumber) || inputNumber.toString() !== content) {
                return;
            }

            const expectedNumber = countState.currentCount + 1;

            // REGEL A: Niet 2 keer achter elkaar door dezelfde persoon
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

            // REGEL B: Moet het exacte volgende getal zijn
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

            // --- ✅ GETAL IS GOED! ---
            countState.currentCount = expectedNumber;
            countState.lastUserId = message.author.id;

            if (countState.currentCount > countState.highScore) {
                countState.highScore = countState.currentCount;
            }

            await message.react('✅').catch(() => null);

            // SPECIAL 1: BIJ GETAL 67
            if (countState.currentCount === 67) {
                await message.reply('**SIXSEVENNN 🗣️🔥**').catch(() => null);
            }

            // SPECIAL 2: BIJ GETAL 1000 (GEWONNEN!)
            if (countState.currentCount === 1000) {
                await message.react('🏆').catch(() => null);
                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 TELSYS TEEM UITGESPEELD!')
                    .setDescription(`🏆 **Gefeliciteerd <@${message.author.id}>!**\n\nJe hebt het getal **1000** gehaald en het telsysteem compleet uitgespeeld! Legend! 🚀`)
                    .setColor('#00FF88')
                    .setTimestamp();

                await message.channel.send({
                    content: `🏆 Gefeliciteerd <@${message.author.id}>! Je hebt gewonnen, je hebt het uitgespeeld! 🎉`,
                    embeds: [winEmbed]
                }).catch(() => null);
            }

            return; // Beëindig hier voor het telkanaal
        }

        // ==========================================================
        // SYSTEEM 2: WOORDENSLANG (#🐍〢word-snake)
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

