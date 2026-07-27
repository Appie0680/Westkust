import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pb')
        .setDescription('Plaats direct het Nexus Community promo bericht')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            const promoText = 
`# 🚀 We’re Back!
# Nexus Community 

**A brand-new server, a fresh start, and more motivation than ever.**

Join our growing community and enjoy:

• Regular Giveaways
• Custom Discord Bot
• Active Community
• Fun Events
• Trusted Partnerships

This is only the beginning. Join us today and be part of something bigger!

🔗 Invite: https://discord.gg/f5XBqE5J2`;

            // Stuur het bericht direct naar het kanaal waar het commando getypt wordt
            await interaction.channel.send({ content: promoText });

            // Stille bevestiging voor de uitvoerder
            return interaction.reply({
                content: '✅ Promo bericht geplaatst!',
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /pb commando:', error);
            return interaction.reply({
                content: '❌ Er is iets misgegaan bij het versturen.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

