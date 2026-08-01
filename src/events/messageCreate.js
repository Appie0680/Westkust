import { 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';

const SWIPE_USER_ID = '1265970903154692167';

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

// Dynamische state voor spellen
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

// 10 Vragen voor Marketing Sollicitatie
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

// --- STARTUP SYNC VOOR TELSYSTEME EN WOORDENSLANG ---
export async function syncGameStatesOnStartup(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            // 1. SYNC TELSYSTEME (#count)
            const countChannel = guild.channels.cache.find(c => 
                c.name.includes('count') && !c.name.includes('log')
            );

            if (countChannel && countChannel.isTextBased()) {
                const fetched = await countChannel.messages.fetch({ limit: 50 }).catch(() => null);
                if (fetched) {
                    for (const msg of fetched.values()) {
                        if (msg.author.bot) continue;
                        const num = parseInt(msg.content.trim(), 10);
                        const isCheck = msg.reactions.cache.some(r => r.emoji.name === '✅');
                        
                        if (!isNaN(num) && num.toString() === msg.content.trim() && isCheck) {
                            global.countingState.currentCount = num;
                            global.countingState.lastUserId = msg.author.id;
                            console.log(`🔢 [SYNC] Telsysteem hersteld op getal: ${num} door ${msg.author.tag}`);
                            break;
                        }
                    }
                }
            }

            // 2. SYNC WOORDENSLANG (#word-snake)
            const snakeChannel = guild.channels.cache.find(c => 
                c.name.includes('word-snake') || c.name.includes('snake')
            );

            if (snakeChannel && snakeChannel.isTextBased()) {
                const fetched = await snakeChannel.messages.fetch({ limit: 50 }).catch(() => null);
                if (fetched) {
                    const validMsgs = [];
                    for (const msg of fetched.values()) {
                        if (msg.author.bot) continue;
                        const word = msg.content.trim().toLowerCase();
                        const wordRegex = /^[a-zA-Záéíóúnñçäëïöü-]+$/;
                        const isCheck = msg.reactions.cache.some(r => r.emoji.name === '✅');

                        if (wordRegex.test(word) && !word.includes(' ') && word.length >= 3 && isCheck) {
                            validMsgs.push({ word, authorId: msg.author.id });
                        }
                    }

                    if (validMsgs.length > 0) {
                        const lastMsg = validMsgs[0];
                        global.wordSnakeState.currentWord = lastMsg.word;
                        global.wordSnakeState.lastLetter = lastMsg.word.slice(-1);
                        global.wordSnakeState.lastUserId = lastMsg.authorId;
                        
                        validMsgs.forEach(m => global.wordSnakeState.usedWords.add(m.word));
                        global.wordSnakeState.snakeLength = global.wordSnakeState.usedWords.size;
                        console.log(`🐍 [SYNC] Woordenslang hersteld op woord: "${lastMsg.word}" (volgende letter: ${global.wordSnakeState.lastLetter.toUpperCase()})`);
                    }
                }
            }

        } catch (e) {
            console.error(`❌ Fout bij syncGameStatesOnStartup voor guild ${guild.id}:`, e);
        }
    }
}

// --- HELPER FUNCTIE: VERWERK BEREIKT UITBETALINGSDOEL IN DM ---
async function handlePayoutTargetReached(client, user, method) {
    try {
        // 1. DM NAAR DE PARTNER DIE HET DOEL BEHAALD HEEFT
        const userWinEmbed = new EmbedBuilder()
            .setTitle('🎉 UITBETALINGS DOEL BEHAALD!')
            .setColor('#00FF88')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `🏆 **Gefeliciteerd <@${user.id}>!**\n\n` +
                `Je hebt jouw uitbetalingsdoel van **${method.target} ${method.unit}** (${method.name}) behaald!\n\n` +
                `📩 **Stuur direct een DM naar <@${SWIPE_USER_ID}> (\`officieel.swipe\`) voor jouw uitbetaling!**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🔄 **Aandacht:** Jouw partner-statistieken zijn nu gereset voor de volgende ronde.\n` +
                `⚙️ **Kies een nieuwe (of dezelfde) uitbetalingsmethode** in het kanaal voor de partner-logs om weer verder te sparen!`
            )
            .setFooter({ text: 'Nexus Partner Payout System' })
            .setTimestamp();

        await user.send({
            content: `🎉 **Gefeliciteerd <@${user.id}>!** Je hebt jouw uitbetalingsdoel behaald! Stuur een DM naar Swipe voor je uitbetaling en kies een nieuwe methode in het partner-log kanaal! 📩`,
            embeds: [userWinEmbed]
        }).catch(() => null);

        // 2. DM NAAR SWIPE VOOR DE BETALING
        const swipeUser = await client.users.fetch(SWIPE_USER_ID).catch(() => null);
        if (swipeUser) {
            const swipeEmbed = new EmbedBuilder()
                .setTitle('💶 NIEUWE UITBETALING VEREIST!')
                .setColor('#FF9900')
                .setDescription(
                    `Oei je hebt weer schulden man, <@${user.id}> (\`${user.tag}\`) heeft het weer behaald denk je aan betaling?\n\n` +
                    `👉 **Gekozen Methode:** \`${method.name}\`\n` +
                    `👉 **Behaald Doel:** \`${method.target} ${method.unit}\``
                )
                .setFooter({ text: 'Nexus Partner System' })
                .setTimestamp();

            await swipeUser.send({
                content: `📢 Oei je hebt weer schulden man, <@${user.id}> heeft het weer behaald denk je aan betaling?`,
                embeds: [swipeEmbed]
            }).catch(() => null);
        }

    } catch (err) {
        console.error('❌ Fout bij afhandelen uitbetalingsdoel DM:', err);
    }
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
        // 1. APPY-STYLE DM SOLLICITATIE BEANTWOORDING
        // ==========================================================
        if (!message.guild) {
            const session = global.userApplySessions.get(message.author.id);
            
            if (!session) {
                const noSessionEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Geen Actieve Sollicitatie')
                    .setColor('#FF9900')
                    .setDescription('Er is momenteel geen actieve sollicitatiesessie gevonden (mogelijk is de bot herstart).\n\nKlik opnieuw op de knop **`📝 Solliciteer voor Marketing`** in de server om te beginnen!');
                
                await message.reply({ embeds: [noSessionEmbed] }).catch(() => null);
                return;
            }

            const questions = global.marketingQuestions || [];
            session.answers.push(message.content.trim());
            session.step += 1;

            if (session.step < questions.length) {
                const nextQuestionEmbed = new EmbedBuilder()
                    .setTitle(`Nexus Community • Marketing Sollicitatie (${session.step + 1}/${questions.length})`)
                    .setColor('#00F0FF')
                    .setDescription(`**${session.step + 1}. ${questions[session.step]}**\n\n*💬 Stuur een bericht in deze DM met jouw antwoord.*`);

                await message.reply({ embeds: [nextQuestionEmbed] }).catch(() => null);
                return;
            }

            const doneEmbed = new EmbedBuilder()
                .setTitle('🎉 Sollicitatie Voltooid!')
                .setColor('#00FF88')
                .setDescription(
                    `Jouw sollicitatie voor het **Marketing Team** is **succesvol verstuurd naar het Beheer van Nexus Community**!\n\n` +
                    `Je ontvangt vanzelf een bericht in DM zodra jouw sollicitatie is beoordeeld.`
                );

            await message.reply({ embeds: [doneEmbed] }).catch(() => null);

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

        const contentTrimmed = message.content.trim().toLowerCase();

        // ==========================================================
        // 2. !pb COMMANDO (PARTNER BERICHT REPLIER)
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
                    c.name === '🍀' + '〢partners' ||
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

                            const choiceKey = global.userPayoutChoices.get(message.author.id) || 'robux';
                            const method = global.payoutMethods.get(choiceKey) || global.payoutMethods.get('robux');
                            const totalEarned = currentCount * method.rate;

                            if (totalEarned >= method.target) {
                                await handlePayoutTargetReached(client, message.author, method);
                                global.userPartnerCounts.set(message.author.id, 0);
                            }

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
        // 3. PARTNER DETECTIE IN #🍀〢partners
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
                    await handlePayoutTargetReached(client, message.author, method);
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
                const newSticky = await message.channel.send({ content: stickyText });
                global.partnerStickyMessageId = newSticky.id;
            } catch (e) {}

            return;
        }

        // ==========================================================
        // 4. GUESS THE NUMBER (#🔔〢guess-the-number)
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
        // 5. TELSYSTEME (#🔢〢count)
        // ==========================================================
        const isCountingChannel = channelName.includes('count') && !channelName.includes('log');

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
        // 6. WOORDENSLANG (#🐍〢word-snake)
        // ==========================================================
        const isSnakeChannel = channelName.includes('word-snake') || channelName.includes('snake');

        if (isSnakeChannel) {
            const state = global.wordSnakeState;
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

