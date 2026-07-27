import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pb')
        .setDescription('Plaats het Nexus Community Partner Broadcast / Promo bericht')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option =>
            option.setName('kanaal')
                .setDescription('Kanaal waar de promo geplaatst moet worden (standaard: dit kanaal)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('embed')
                .setDescription('Versturen als een mooie Embed? (Ja = Strakke embed, Nee = Plat tekstbericht)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('kanaal') || interaction.channel;
            const useEmbed = interaction.options.getBoolean('embed') ?? true;
            const inviteUrl = 'https://discord.gg/f5XBqE5J2';

            // Knop maken om direct mee te treden
            const joinButton = new ButtonBuilder()
                .setLabel('Join Nexus Community')
                .setStyle(ButtonStyle.Link)
                .setURL(inviteUrl)
                .setEmoji('🚀');

            const row = new ActionRowBuilder().addComponents(joinButton);

            if (useEmbed) {
                // STIJLVOLLE EMBED VERSIE
                const pbEmbed = new EmbedBuilder()
                    .setTitle('🚀 We’re Back! • Nexus Community')
                    .setDescription(
                        `**A brand-new server, a fresh start, and more motivation than ever.**\n\n` +
                        `Join our growing community and enjoy:\n\n` +
                        `• 🎁 **Regular Giveaways**\n` +
                        `• 🤖 **Custom Discord Bot**\n` +
                        `• 💬 **Active Community**\n` +
                        `• 🎉 **Fun Events**\n` +
                        `• 🤝 **Trusted Partnerships**\n\n` +
                        `*This is only the beginning. Join us today and be part of something bigger!*`
                    )
                    .setColor('#5865F2') // Discord Blurple Kleur
                    .setFooter({ 
                        text: 'Nexus Community Promo', 
                        iconURL: interaction.guild.iconURL({ dynamic: true }) 
                    })
                    .setTimestamp();

                await targetChannel.send({
                    embeds: [pbEmbed],
                    components: [row]
                });
            } else {
                // PLAT-TEKST VERSIE MET MARKDOWN
                const rawMessage = 
                    `# 🚀 We’re Back!\n` +
                    `# Nexus Community\n\n` +
                    `**A brand-new server, a fresh start, and more motivation than ever.**\n\n` +
                    `Join our growing community and enjoy:\n\n` +
                    `• Regular Giveaways\n` +
                    `• Custom Discord Bot\n` +
                    `• Active Community\n` +
                    `• Fun Events\n` +
                    `• Trusted Partnerships\n\n` +
                    `This is only the beginning. Join us today and be part of something bigger!\n\n` +
                    `🔗 Invite: ${inviteUrl}`;

                await targetChannel.send({
                    content: rawMessage,
                    components: [row]
                });
            }

            return interaction.reply({
                content: `✅ **Partner Broadcast / Promo succesvol geplaatst in ${targetChannel}!**`,
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /pb commando:', error);
            return interaction.reply({
                content: '❌ Er ging iets mis bij het versturen van het promo-bericht.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

