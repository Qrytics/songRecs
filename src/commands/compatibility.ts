import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { getUserSimilarity, getSharedArtists } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('compatibility')
  .setDescription('Check music compatibility with another user')
  .addUserOption((option) =>
    option.setName('user').setDescription('The user to check compatibility with').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const discordId = interaction.user.id;
  const targetUser = interaction.options.getUser('user', true);

  try {
    const [userResult, targetResult] = await Promise.all([
      pool.query(`SELECT id, username FROM users WHERE discord_id = $1`, [discordId]),
      pool.query(`SELECT id, username FROM users WHERE discord_id = $1`, [targetUser.id]),
    ]);

    if (userResult.rows.length === 0) {
      await interaction.editReply('❌ You haven\'t registered a playlist yet. Use `/addplaylist` first!');
      return;
    }
    if (targetResult.rows.length === 0) {
      await interaction.editReply(`❌ **${targetUser.username}** hasn't registered a playlist yet.`);
      return;
    }

    const userId: number = userResult.rows[0].id;
    const targetId: number = targetResult.rows[0].id;

    const [similarity, sharedArtists] = await Promise.all([
      getUserSimilarity(userId, targetId),
      getSharedArtists(userId, targetId),
    ]);

    const pct = Math.round(similarity * 100);
    const artistList =
      sharedArtists.length > 0
        ? sharedArtists.slice(0, 5).join('\n')
        : 'None found';

    const embed = new EmbedBuilder()
      .setTitle(`❤️ Music Compatibility`)
      .setColor(pct > 75 ? 0x1db954 : pct > 50 ? 0xffa500 : 0xff4444)
      .addFields(
        {
          name: '👥 Pair',
          value: `${interaction.user.username} + ${targetUser.username}`,
          inline: false,
        },
        { name: '💯 Compatibility', value: `${pct}%`, inline: true },
        {
          name: '🎸 Shared Artists',
          value: artistList,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('compatibility error:', err);
    await interaction.editReply('❌ Something went wrong checking compatibility.');
  }
}
