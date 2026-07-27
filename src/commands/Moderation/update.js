import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Stuur een officieel update-bericht naar een kanaal')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option =>
            option.setName('kanaal')
                .setDescription('Het kanaal waar de update geplaatst moet worden')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('titel')
                .setDescription('De titel van de update')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('bericht')
                .setDescription('De inhoud van het update-bericht')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('ping_rol')
                .setDescription('Selecteer een rol om te pingen (optioneel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const channel = interaction.options.getChannel('kanaal');
            const title = interaction.options.getString('titel');
            const message = interaction.options.getString('bericht');
            const role = interaction.options.getRole('ping_rol');

            // Controleer of de bot in het opgegeven kanaal berichten mag sturen
            if (!channel.isTextBased()) {
                return interaction.reply({
                    content: '❌ Het geselecteerde kanaal moet een tekstkanaal zijn.',
                    ephemeral: true
                });
            }

            // Maak een mooie Embed voor het update-bericht
            const updateEmbed = new EmbedBuilder()
                .setTitle(`📢 ${title}`)
                .setDescription(message)
                .setColor('#00ffbb')
                .setTimestamp()
                .setFooter({
                    text: `Update geplaatst door ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            // Verstuur het bericht naar het kanaal
            const pingText = role ? `<@&${role.id}>` : '';
            await channel.send({
                content: pingText,
                embeds: [updateEmbed]
            });

            // Bevestiging voor degene die het commando uitvoert
            return interaction.reply({
                content: `✅ De update is succesvol geplaatst in ${channel}!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Fout bij uitvoeren van /update:', error);
            return interaction.reply({
                content: '❌ Er is een fout opgetreden bij het versturen van de update.',
                ephemeral: true
            }).catch(() => null);
        }
    }
};

