import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pb')
        .setDescription('Plaats direct het Nexus Community partner bericht')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            const messageText = 
                `# 🚀 We’re Back!\n` +
                `# Nexus Community \n\n` +
                `**A brand-new server, a fresh start, and more motivation than ever.**\n\n` +
                `Join our growing community and enjoy:\n\n` +
                `• Regular Giveaways\n` +
                `• Custom Discord Bot\n` +
                `• Active Community\n` +
                `• Fun Events\n` +
                `• Trusted Partnerships\n\n` +
                `This is only the beginning. Join us today and be part of something bigger!\n\n` +
                `🔗 Invite: https://discord.gg/f5XBqE5J2`;

            // Stuur het bericht direct naar het kanaal
            await interaction.channel.send({ content: messageText });

            // Onzichtbare bevestiging voor jou zodat Discord niet klaagt over een haperende interactie
            return interaction.reply({
                content: '✅ Partner bericht geplaatst!',
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Fout bij /pb commando:', error);
            return interaction.reply({
                content: '❌ Er ging iets mis bij het versturen van het bericht.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

