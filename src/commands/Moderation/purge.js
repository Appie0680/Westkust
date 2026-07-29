import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder 
} from 'discord.js';

// Herbruikbare purge logica voor zowel Slash jako Prefix commando (?purge)
export async function executePurge(channel, member, amount, replyTarget = null) {
    try {
        // Permissie check
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const errEmbed = new EmbedBuilder()
                .setTitle('🚫 Geen Toegang')
                .setColor('#FF0033')
                .setDescription('Je hebt de machtiging `Berichten Beheren` nodig om dit commando uit te voeren.');
            
            if (replyTarget) return replyTarget.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
            return channel.send({ embeds: [errEmbed] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
        }

        // Limiet controle (max 100 berichten per keer vanwege Discord API)
        const fetchAmount = Math.min(Math.max(amount, 1), 100);

        // Berichten ophalen
        const fetchedMessages = await channel.messages.fetch({ limit: fetchAmount }).catch(() => null);

        if (!fetchedMessages || fetchedMessages.size === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle('⚠️ Geen Berichten Gevonden')
                .setColor('#FF9900')
                .setDescription('Er konden geen berichten worden gevonden om te verwijderen.');

            if (replyTarget) return replyTarget.reply({ embeds: [emptyEmbed], ephemeral: true }).catch(() => null);
            return channel.send({ embeds: [emptyEmbed] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
        }

        // Tel hoeveel bijlagen/foto's erbij zaten
        let attachmentCount = 0;
        fetchedMessages.forEach(msg => {
            if (msg.attachments && msg.attachments.size > 0) {
                attachmentCount += msg.attachments.size;
            }
        });

        // Verwijder de berichten via Bulk Delete
        const deleted = await channel.bulkDelete(fetchedMessages, true).catch(err => {
            console.error('❌ Bulk delete fout:', err);
            return null;
        });

        const deletedCount = deleted ? deleted.size : 0;

        // Luxe succes embed
        const successEmbed = new EmbedBuilder()
            .setTitle('🧹 Kanaal Opgeschoond')
            .setColor('#00F0FF')
            .setThumbnail(member.guild.iconURL({ dynamic: true }))
            .setDescription(
                `>>> **🗑️ Verwijderde Berichten:** \`${deletedCount}\`\n` +
                `**🖼️ Bijlagen / Foto's:** \`${attachmentCount}\`\n` +
                `**🛡️ Uitgevoerd door:** <@${member.id}>`
            )
            .setFooter({ text: 'Dit bericht verdwijnt automatisch over 5 seconden...' })
            .setTimestamp();

        if (replyTarget && replyTarget.replied === false) {
            await replyTarget.reply({ embeds: [successEmbed], ephemeral: true }).catch(() => null);
        } else {
            const statusMsg = await channel.send({ embeds: [successEmbed] }).catch(() => null);
            if (statusMsg) {
                setTimeout(() => statusMsg.delete().catch(() => null), 5000);
            }
        }

    } catch (error) {
        console.error('❌ Fout bij uitvoeren van Purge:', error);
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Verwijder snel een aantal berichten en bijlagen uit het kanaal (Beheer)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('aantal')
                .setDescription('Het aantal berichten dat verwijderd moet worden (1 - 100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger('aantal');
        await executePurge(interaction.channel, interaction.member, amount, interaction);
    }
};

