import { Events, EmbedBuilder } from 'discord.js';

// Opslag voor de status van de Woordenslang game in het geheugen
if (!global.wordSnakeState) {
    global.wordSnakeState = {
        currentWord: 'slang', // Beginwoord
        lastLetter: 'g',
        lastUserId: null,
        usedWords: new Set(['slang']),
        snakeLength: 1,
        highScore: 1
    };
}

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        // Sla botberichten en berichten buiten servers over
        if (message.author.bot || !message.guild) return;

        // Controleer of het bericht in het Woordenslang kanaal staat
        const isSnakeChannel = 
            message.channel.name === '🐍〢word-snake' ||
            message.channel.name === 'word-snake' ||
            message.channel.name.includes('word-snake');

        if (!isSnakeChannel) return;

        const state = global.wordSnakeState;
        const inputWord = message.content.trim().toLowerCase();

        // Negeer commando's die beginnen met / of !
        if (inputWord.startsWith('/') || inputWord.startsWith('!')) return;

        // --- REGEL 1: Enkel 1 woord (geen spaties of leestekens) ---
        const wordRegex = /^[a-zA-Záéíóúnñçäëïöü-]+$/;
        if (!wordRegex.test(inputWord) || inputWord.includes(' ')) {
            await message.react('❌').catch(() => null);
            const reply = await message.reply('⚠️ **Geen geldig woord!** Stuur enkel één enkel woord zonder spaties of leestekens.').catch(() => null);
            setTimeout(() => {
                reply?.delete().catch(() => null);
                message.delete().catch(() => null);
            }, 5000);
            return;
        }

        // --- REGEL 2: Minimale lengte (minstens 3 letters) ---
        if (inputWord.length < 3) {
            await message.react('❌').catch(() => null);
            const reply = await message.reply('⚠️ **Te kort!** Een woord moet minstens 3 letters lang zijn.').catch(() => null);
            setTimeout(() => {
                reply?.delete().catch(() => null);
                message.delete().catch(() => null);
            }, 5000);
            return;
        }

        // --- REGEL 3: Niet twee keer achter elkaar door dezelfde persoon ---
        if (state.lastUserId === message.author.id) {
            await message.react('❌').catch(() => null);
            const reply = await message.reply('🚫 **Niet zo snel!** Laat eerst iemand anders een woord leggen voordat jij weer mag.').catch(() => null);
            setTimeout(() => {
                reply?.delete().catch(() => null);
                message.delete().catch(() => null);
            }, 5000);
            return;
        }

        // --- REGEL 4: Moet beginnen met de laatste letter van het vorige woord ---
        const firstLetter = inputWord.charAt(0);
        if (firstLetter !== state.lastLetter) {
            await message.react('❌').catch(() => null);
            const reply = await message.reply(`❌ **Foute beginletter!** Het woord moet beginnen met de letter **\`${state.lastLetter.toUpperCase()}\`** (van *${state.currentWord}*).`).catch(() => null);
            setTimeout(() => {
                reply?.delete().catch(() => null);
                message.delete().catch(() => null);
            }, 5000);
            return;
        }

        // --- REGEL 5: Geen herhaling van al gebruikte woorden ---
        if (state.usedWords.has(inputWord)) {
            await message.react('❌').catch(() => null);
            const reply = await message.reply(`⚠️ **Al gebruikt!** Het woord **\`${inputWord}\`** is al eerder gelegd in deze slang.`).catch(() => null);
            setTimeout(() => {
                reply?.delete().catch(() => null);
                message.delete().catch(() => null);
            }, 5000);
            return;
        }

        // --- ✅ WOORD GOEDGEKEURD! ---
        state.usedWords.add(inputWord);
        state.currentWord = inputWord;
        state.lastLetter = inputWord.slice(-1); // Pak de laatste letter
        state.lastUserId = message.author.id;
        state.snakeLength += 1;

        if (state.snakeLength > state.highScore) {
            state.highScore = state.snakeLength;
        }

        // Reageer met een groen vinkje op het bericht
        await message.react('✅').catch(() => null);

        // Mijlpalen vieren (bijv. bij 10, 25, 50, 100 woorden)
        if (state.snakeLength % 10 === 0) {
            await message.react('🐍').catch(() => null);
            const milestoneEmbed = new EmbedBuilder()
                .setTitle('🎉 Mijlpaal Bereikt!')
                .setDescription(`De Woordenslang is nu **${state.snakeLength} woorden** lang!\nHet huidige woord is: **\`${inputWord}\`** (volgende letter: **\`${state.lastLetter.toUpperCase()}\`**)`)
                .setColor('#00FF88');
            
            await message.channel.send({ embeds: [milestoneEmbed] }).catch(() => null);
        }
    }
};

