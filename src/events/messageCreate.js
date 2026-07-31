import { 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';

import { executePurge } from '../commands/moderation/purge.js';

// --- GLOBALE GEHEUGENSTORES ---
if (!global.loggedPartnerLinks) global.loggedPartnerLinks = new Set();
if (!global.userPartnerCounts) global.userPartnerCounts = new Map();
if (!global.userPayoutChoices) global.userPayoutChoices = new Map();
if (!global.partnerLeaderboardMessageId) global.partnerLeaderboardMessageId = null;
if (!global.partnerStickyMessageId) global.partnerStickyMessageId = null;

if (!global.userApplySessions) global.userApplySessions = new Map();

if (!global.payoutMethods) {
    global.payoutMethods = new Map([
        ['robux', { name: 'Robux', rate: 10, target: 800, unit: 'Robux' }],
        ['springbank', { name: 'Springbank Coins', rate: 83, target: 500, unit: 'Coins' }],
        ['geld', { name: 'Geld (€)', rate: 0.12, target: 10.00, unit: '€' }]
    ]);
}

// Dynamische state voor minigames
if (!global.wordSnakeState) {
    global.wordSnakeState = {
        currentWord: null,
        lastLetter: null,
        lastUserId: null,
        usedWords: new Set(),
        snakeLength: 0,
        highScore: 0,
        initialized: false
    };
}

if (!global.countingState) {
    global.countingState = {
        currentCount: 0,
        lastUserId: null,
        highScore: 0,
        initialized: false
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

// Vragenlijst voor Marketing
if (!global.marketingQuestions) {
    global.marketingQuestions = [
        "Wat is jouw Naam?",
        "Wat is jouw Leeftijd?",
        "Vertel kort iets over jezelf.",
        "Waarom wil je in het marketing team werken?",
        "Waarom wil je bij Nexus Community werken?",
        "Wat zijn jouw sterke en zwakke punten?",
        "Hoe ga je om met feedback?",
        "Waarom moeten wij jou aannemen?",
        "Wanneer ben je beschikbaar om te beginnen? (Bijvoorbeeld: over 2 weken)",
        "Heb je tot slot nog vragen aan ons?"
    ];
}

// --- HELPER FUNCTIE: TELSYSTEME STAND DYNAMISCH OPHALEN (SLAAT HUIDIG BERICHT OVER) ---
async function ensureCountingState(channel, currentMessageId) {
    const state = global.countingState;
    if (state.initialized) return;

    try {
        const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
        if (messages) {
            for (const [id, msg] of messages) {
                // Sla bots én het huidige net ingestuurde bericht over!
                if (msg.author.bot || msg.id === currentMessageId) continue;
                
                const num = parseInt(msg.content.trim(), 10);
                if (!isNaN(num) && num.toString() === msg.content.trim()) {
                    state.currentCount = num;
                    state.lastUserId = msg.author.id;
                    state.initialized = true;
                    return;
                }
            }
        }
    } catch (e) {}
    state.initialized = true;
}

// --- HELPER FUNCTIE: WOORDENSLANG STAND DYNAMISCH OPHALEN (SLAAT HUIDIG BERICHT OVER) ---
async function ensureWordSnakeState(channel, currentMessageId) {
    const state = global.wordSnakeState;
    if (state.initialized) return;

    try {
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
            const validMessages = [];
            for (const [id, msg] of messages) {
                // Sla bots én het huidige net ingestuurde bericht over!
                if (msg.author.bot || msg.id === currentMessageId) continue;
                
                const word = msg.content.trim().toLowerCase();
                const wordRegex = /^[a-zA-Záéíóúnñçäëïöü-]+$/;
                
                if (wordRegex.test(word) && !word.includes(' ') && word.length >= 3) {
                    validMessages.push({ word, authorId: msg.author.id, msg });
                }
            }

            if (validMessages.length > 0) {
                const lastMsg = validMessages[0];
                state.currentWord = lastMsg.word;
                state.lastLetter = lastMsg.word.slice(-1);
                state.lastUserId = lastMsg.authorId;
                
                validMessages.forEach(m => state.usedWords.add(m.word));
                state.snakeLength = state.usedWords.size;
                state.initialized = true;
                return;
            }
        }
    } catch (e) {}

    state.currentWord = 'slang';
    state.lastLetter = 'g';
    state.usedWords.add('slang');
    state.snakeLength = 1;
    state.initialized = true;
}

// --- HELPER FUNCTIE: PARTNER LEADERBOARD UPDATEN ---
async function updatePartnerLeaderboard(client, guild) {
    try {
        const logChannel = guild.channels.cache.find(c => 
            c.name.includes('partner-log') || 
            c.name.includes('partner_log') || 
            c.name.includes('partnerlog')
        );

        if (!logChannel) return;

        let leaderboardText = '';
        if (!global.userPartnerCounts || global.userPartnerCounts.size === 0) {
            leaderboardText = '*`Nog geen actieve partners geregistreerd.`*\n*Plaats een link in #🍀' + '〢partners om te beginnen!*';
        } else {
            const sorted = Array.from(global.userPartnerCounts.entries())
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1]);

            if (sorted.length === 0) {
                leaderboardText = '*`Nog geen actieve partners geregistreerd.`*';
            } else {
                let rank = 1;
                for (const [userId, count] of sorted) {
                    const choiceKey = global.userPayoutChoices.get(userId) || 'robux';
                    const method = global.payoutMethods.get(choiceKey) || global.payoutMethods.get('robux');
                    
                    const earned = count * method.rate;
                    const percent = Math.min(100, Math.round((earned / method.target) * 100));
                    
                    const earnedStr = method.unit === '€' ? `€ ${earned.toFixed(2)}` : `${earned} ${method.unit}`;
                    const targetStr = method.unit === '€' ? `€ ${method.target.toFixed(2)}` : `${method.target} ${method.unit}`;

                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '👤';
                    
                    leaderboardText += `${medal} <@${userId}>\n` +
                        `└ 📊 **${count} Partners** • \`${earnedStr} / ${targetStr}\` (\`${percent}%\` • ${method.name})\n\n`;
                    rank++;
                }
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 NEXUS MARKETING HUB • PARTNER LEADERBOARD')
            .setColor('#00F0FF')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setDescription(
                `>>> **Welkom bij het officiële Nexus Partner & Marketing Dashboard!**\n` +
                `Plaats partnerlinks in het partnerkanaal en verdien direct punten voor jouw uitbetalingsdoel!\n\n` +
                `💳 **Huidige Uitbetalingskoersen:**\n` +
                `• 🪙 **Robux:** \`10 Robux / partner\` *(Doel: 800 Robux)*\n` +
                `• 🪙 **Springbank Coins:** \`83 Coins / partner\` *(Doel: 500 Coins)*\n` +
                `• 💶 **Geld (€):** \`€ 0,12 / partner\` *(Doel: € 10,00)*\n\n` +
                `🏆 **Live Team Ranglijst:**\n` +
                `${leaderboardText}`
            )
            .setFooter({ text: '⚙️ Kies hieronder jouw gewenste uitbetalingsmethode • Nexus Hub', iconURL: guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        const options = [];
        for (const [key, m] of global.payoutMethods) {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(m.name)
                    .setValue(key)
                    .setDescription(`${m.rate} ${m.unit}/partner • Doel: ${m.target} ${m.unit}`)
            );
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_payout_method')
            .setPlaceholder('⚙️ Kies of wijzig jouw uitbetalingsmethode...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        let existingMsg = null;
        if (global.partnerLeaderboardMessageId) {
            existingMsg = await logChannel.messages.fetch(global.partnerLeaderboardMessageId).catch(() => null);
        }

        if (!existingMsg) {
            const fetched = await logChannel.messages.fetch({ limit: 20 }).catch(() => null);
            if (fetched) {
                existingMsg = fetched.find(m => 
                    m.author.id === client.user.id && 
                    m.embeds.length > 0 && 
                    m.embeds[0].title && 
                    m.embeds[0].title.includes('PARTNER LEADERBOARD')
                );
            }
        }

        if (existingMsg) {
            global.partnerLeaderboardMessageId = existingMsg.id;
            await existingMsg.edit({ embeds: [embed], components: [row] }).catch(() => null);
        } else {
            const newMsg = await logChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
            if (newMsg) {
                global.partnerLeaderboardMessageId = newMsg.id;
            }
        }

    } catch (err) {
        console.error('❌ Fout bij updatePartnerLeaderboard:', err);
    }
}

global.updatePartnerLeaderboard = updatePartnerLeaderboard;

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (message.author.bot) return;

        // ==========================================================
        // FEATURE 1: DM SOLLICITATIE BEANTWOORDING
        // ==========================================================
        if (!message.guild) {
            const session = global.userApplySessions.get(message.author.id);
            if (!session) return;

            const questions = global.marketingQuestions || [];
            session.answers.push(message.content.trim());
            session.step += 1;

            if (session.step < questions.length) {
                const nextQuestionEmbed = new EmbedBuilder()
                    .setTitle(`Nexus Community • Marketing Sollicitatie (${session.step + 1}/${questions.length})`)
                    .setColor('#00F0FF')
                    .setDescription(`**${session.step + 1}. ${questions[session.step]}**\n\n*💬 Stuur een bericht in deze DM met jouw antwoord.*`);

                await message.channel.send({ embeds: [nextQuestionEmbed] }).catch(() => null);
                return;
            }

            const doneEmbed = new EmbedBuilder()
                .setTitle('🎉 Sollicitatie Voltooid!')
                .setColor('#00FF88')
                .setDescription(
                    `Jouw sollicitatie voor het **Marketing Team** is **succesvol verstuurd naar het Beheer van Nexus Community**!\n\n` +
                    `Je ontvangt vanzelf een bericht in DM zodra jouw sollicitatie is beoordeeld.`
                );

            await message.channel.send({ embeds: [doneEmbed] }).catch(() => null);

            try {
                const guild = client.guilds.cache.get(session.guildId) || client.guilds.cache.first();
                if (guild) {
                    const resultChannel = guild.channels.cache.find(c => 
                        c.name.includes('application-results') || 
                        c.name.includes('application_results') ||
                        c.name.includes('sollicitatie-resultaten') ||
                        c.name.includes('results')
                    );

                    if (resultChannel) {
                        const resultEmbed = new EmbedBuilder()
                            .setTitle(`📑 Nieuwe Sollicitatie Marketing • ${session.answers[0] || message.author.username}`)
                            .setColor('#00F0FF')
                            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                            .setDescription(
                                `>>> **👤 Sollicitant:** <@${message.author.id}> (\`${message.author.tag}\`)\n` +
                                `**📛 Naam:** \`${session.answers[0] || 'N.v.t.'}\`\n` +
                                `**🎂 Leeftijd:** \`${session.answers[1] || 'N.v.t.'}\`\n` +
                                `**📊 Status:** \`⏳ In Behandeling\``
                            )
                            .setTimestamp();

                        for (let i = 2; i < questions.length; i++) {
                            resultEmbed.addFields({
                                name: `❓ ${questions[i]}`,
                                value: session.answers[i] ? `> ${session.answers[i]}` : '> *Geen antwoord*'
                            });
                        }

                        const acceptBtn = new ButtonBuilder()
                            .setCustomId(`accept_app_${message.author.id}`)
                            .setLabel('✅ Goedgekeurd')
                            .setStyle(ButtonStyle.Success);

                        const denyBtn = new ButtonBuilder()
                            .setCustomId(`deny_app_${message.author.id}`)
                            .setLabel('❌ Afgekeurd')
                            .setStyle(ButtonStyle.Danger);

                        const actionRow = new ActionRowBuilder().addComponents(acceptBtn, denyBtn);

                        await resultChannel.send({ embeds: [resultEmbed], components: [actionRow] }).catch(() => null);
                    }
                }
            } catch (err) {
                console.error('❌ Fout bij doorsturen sollicitatie resultaat:', err);
            }

            global.userApplySessions.delete(message.author.id);
            return;
        }

        if (!message.guild) return;

        const contentTrimmed = message.content.trim().toLowerCase();

        // ==========================================================
        // FEATURE 2: ?PURGE / ?CLEAR COMMANDO
        // ==========================================================
        if (
            contentTrimmed.startsWith('?purge') || 
            contentTrimmed.startsWith('!purge') || 
            contentTrimmed.startsWith('?clear') || 
            contentTrimmed.startsWith('!clear')
        ) {
            const args = message.content.trim().split(/\s+/);
            const amountInput = parseInt(args[1], 10);

            if (isNaN(amountInput) || amountInput <= 0) {
                const warnMsg = await message.reply('⚠️ **Gebruik:** Typ `?purge <aantal>` (bijv. `?purge 100`).').catch(() => null);
                setTimeout(() => {
                    warnMsg?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 5000);
                return;
            }

            await message.delete().catch(() => null);
            await executePurge(message.channel, message.member, amountInput, null);
            return;
        }

        // ==========================================================
        // FEATURE 3: !pb COMMANDO (PARTNER BERICHT REPLIER)
        // ==========================================================
        if (contentTrimmed === '!pb' || contentTrimmed.startsWith('!pb ') || contentTrimmed === '!partnerbericht') {
            if (!message.reference || !message.reference.messageId) {
                const warnEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Partner Bericht Instructie')
                    .setColor('#FF9900')
                    .setDescription('Reageer (**reply**) op het partnerbericht dat je wilt doorsturen en typ simpelweg `!pb`.')
                    .setFooter({ text: 'Nexus Partner System' });

                const errReply = await message.reply({ embeds: [warnEmbed] }).catch(() => null);
                setTimeout(() => {
                    errReply?.delete().catch(() => null);
                    message.delete().catch(() => null);
                }, 6000);
                return;
            }

            try {
                const targetMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                if (!targetMessage) {
                    return message.reply({ content: '❌ Kon het originele partnerbericht niet ophalen.' }).catch(() => null);
                }

                const partnerChannel = message.guild.channels.cache.find(c => 
                    (c.name.includes('partner') && !c.name.includes('log')) ||
                    c.name === '🍀' + '®partners' ||
                    c.name === 'partners'
                );

                if (!partnerChannel) {
                    return message.reply({ content: '❌ Het partnerkanaal (`#🍀' + '〢partners`) kon niet worden gevonden!' }).catch(() => null);
                }

                const payload = {};
                if (targetMessage.content) payload.content = targetMessage.content;
                if (targetMessage.embeds && targetMessage.embeds.length > 0) payload.embeds = targetMessage.embeds;
                if (targetMessage.attachments && targetMessage.attachments.size > 0) {
                    payload.files = Array.from(targetMessage.attachments.values()).map(a => a.url);
                }

                const sentMsg = await partnerChannel.send(payload).catch(() => null);

                if (sentMsg) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✨ NEXUS PARTNER HUB • BERICHT VERWERKT')
                        .setColor('#00F0FF')
                        .setThumbnail(message.guild.iconURL({ dynamic: true }))
                        .setDescription(
                            `>>> **📬 Status:** \`Gepubliceerd in\` <#${partnerChannel.id}>\n` +
                            `**🛡️ Uitgevoerd door:** <@${message.author.id}>\n` +
                            `**📈 Voortgang:** \`+1 Partner bijgeschreven op leaderboard!\``
                        )
                        .setFooter({ text: 'Nexus Community • Official Partner System', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp();

                    await message.reply({ embeds: [successEmbed] }).catch(() => null);

                    const nexusPartnerPromo = 
                        `# 🚀 We’re Back!\n` +
                        `# Nexus Community \n\n` +
                        `**A brand-new server, a fresh start, and more motivation than ever.**\n\n` +
                        `**Join our growing community and enjoy:**\n` +
                        `• 🎁 **Regular Giveaways**\n` +
                        `• 🤖 **Custom Discord Bot**\n` +
                        `• 💬 **Active Community**\n` +
                        `• 🎮 **Fun Events**\n` +
                        `• 🤝 **Trusted Partnerships**\n\n` +
                        `*This is only the beginning. Join us today and be part of something bigger!*\n\n` +
                        `🔗 **Invite Link:** https://discord.gg/f5XBqE5J2`;

                    await message.channel.send({ content: nexusPartnerPromo }).catch(() => null);

                    const discordInviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.me|discordapp\.com\/invite|discord\.com\/invite)\/([a-zA-Z0-9-]{2,32})/gi;
                    const matches = targetMessage.content ? targetMessage.content.match(discordInviteRegex) : null;

                    if (matches && matches.length > 0) {
                        const inviteLink = matches[0].toLowerCase();
                        if (!global.loggedPartnerLinks.has(inviteLink)) {
                            global.loggedPartnerLinks.add(inviteLink);
                            const currentCount = (global.userPartnerCounts.get(message.author.id) || 0) + 1;
                            global.userPartnerCounts.set(message.author.id, currentCount);
                            await updatePartnerLeaderboard(client, message.guild);
                        }
                    }

                    try {
                        if (global.partnerStickyMessageId) {
                            const oldSticky = await partnerChannel.messages.fetch(global.partnerStickyMessageId).catch(() => null);
                            if (oldSticky) await oldSticky.delete().catch(() => null);
                        }
                        const stickyText = `# We are against Scam, negative and leak servers. So we don't partner with this either`;
                        const newSticky = await partnerChannel.send({ content: stickyText });
                        global.partnerStickyMessageId = newSticky.id;
                    } catch (e) {}

                } else {
                    await message.reply({ content: '❌ Fout bij het doorsturen van het bericht naar het partnerkanaal.' }).catch(() => null);
                }

            } catch (err) {
                console.error('❌ Fout bij !pb execution:', err);
                await message.reply({ content: '❌ Er ging iets mis bij het uitvoeren van `!pb`.' }).catch(() => null);
            }
            return;
        }

        const channelName = message.channel.name.toLowerCase();

        // ==========================================================
        // FEATURE 4: PARTNER SYSTEM DIRECT IN #🍀〢partners
        // ==========================================================
        const isPartnerChannel = channelName.includes('partner') && !channelName.includes('log');

        if (isPartnerChannel) {
            const discordInviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.me|discordapp\.com\/invite|discord\.com\/invite)\/([a-zA-Z0-9-]{2,32})/gi;
            const matches = message.content.match(discordInviteRegex);

            if (matches && matches.length > 0) {
                const inviteLink = matches[0].toLowerCase();

                if (global.loggedPartnerLinks.has(inviteLink)) {
                    await message.react('❌').catch(() => null);
                    const reply = await message.reply('⚠️ Deze partner-link is al eerder ingestuurd en telt niet dubbel mee!').catch(() => null);
                    setTimeout(() => reply?.delete().catch(() => null), 5000);
                    return;
                }

                global.loggedPartnerLinks.add(inviteLink);
                await message.react('✅').catch(() => null);

                const currentCount = (global.userPartnerCounts.get(message.author.id) || 0) + 1;
                global.userPartnerCounts.set(message.author.id, currentCount);

                const choiceKey = global.userPayoutChoices.get(message.author.id) || 'robux';
                const method = global.payoutMethods.get(choiceKey) || global.payoutMethods.get('robux');

                const totalEarned = currentCount * method.rate;

                if (totalEarned >= method.target) {
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

                    global.userPartnerCounts.set(message.author.id, 0);
                }

                await updatePartnerLeaderboard(client, message.guild);
            }

            try {
                if (global.partnerStickyMessageId) {
                    const oldSticky = await partnerChannel.messages.fetch(global.partnerStickyMessageId).catch(() => null);
                    if (oldSticky) await oldSticky.delete().catch(() => null);
                }

                const stickyText = `# We are against Scam, negative and leak servers. So we don't partner with this either`;
                const newSticky = await partnerChannel.send({ content: stickyText });
                global.partnerStickyMessageId = newSticky.id;
            } catch (e) {}

            return;
        }

        // ==========================================================
        // GAME 1: GUESS THE NUMBER (#🔔〢guess-the-number)
        // ==========================================================
        const isGuessChannel = channelName.includes('guess');

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
        const isCountingChannel = channelName.includes('count');

        if (isCountingChannel) {
            await ensureCountingState(message.channel, message.id);
            const countState = global.countingState;
            const content = message.content.trim();

            if (content.startsWith('/') || content.startsWith('!') || content.startsWith('?')) return;

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
        const isSnakeChannel = channelName.includes('word-snake') || channelName.includes('snake');

        if (isSnakeChannel) {
            await ensureWordSnakeState(message.channel, message.id);
            const state = global.wordSnakeState;
            const inputWord = message.content.trim().toLowerCase();

            if (inputWord.startsWith('/') || inputWord.startsWith('!') || inputWord.startsWith('?')) return;

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

