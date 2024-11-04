const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config(); // Make sure to require dotenv

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const GROUPS = JSON.parse(process.env.GROUPS); // Ensure GROUPS is set in environment
const previousMembers = {};

client.login(process.env.DISCORD_BOT_TOKEN);

// Main API function to handle requests
module.exports = async (req, res) => {
    for (const group of GROUPS) {
        await checkForChanges(group.id, group.channel);
    }
    res.status(200).send('Checked for changes!');
};

async function checkForChanges(groupId, discordChannelId) {
    try {
        let currentMembers = new Map();
        let cursor = null;
        let hasMorePages = true;

        while (hasMorePages) {
            const url = `https://groups.roblox.com/v1/groups/${groupId}/users${cursor ? `?cursor=${cursor}` : ''}`;
            const response = await axios.get(url);
            const members = response.data.data;

            members.forEach(member => {
                const username = member.user.username;
                const rankName = member.role.name;
                currentMembers.set(username, rankName);

                if (previousMembers[groupId]?.has(username)) {
                    if (previousMembers[groupId].get(username) !== rankName) {
                        logToDiscord(discordChannelId, "Rank Change", `${username} Rank changed from **${previousMembers[groupId].get(username)}** to **${rankName}**.`, 'YELLOW');
                    }
                } else {
                    logToDiscord(discordChannelId, "Member Joined", `${username} has joined the group!`, 'GREEN');
                }
            });

            cursor = response.data.nextPageCursor;
            hasMorePages = !!cursor;
            if (hasMorePages) await new Promise(resolve => setTimeout(resolve, 1000));
        }

        previousMembers[groupId]?.forEach((rank, username) => {
            if (!currentMembers.has(username)) {
                logToDiscord(discordChannelId, "Member Left", `${username} has left the group.`, 'RED');
            }
        });

        previousMembers[groupId] = currentMembers;
        saveCurrentMembers(groupId, currentMembers);
    } catch (error) {
        console.error('Error fetching group members:', error);
    }
}

function logToDiscord(discordChannelId, title, description, color) {
    const channel = client.channels.cache.get(discordChannelId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(color === 'GREEN' ? 0x00FF00 : color === 'YELLOW' ? 0xFFFF00 : 0xFF0000)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        
        channel.send({ embeds: [embed] }).catch(console.error);
    }
}

function saveCurrentMembers(groupId, currentMembers) {
    const membersObject = Object.fromEntries(currentMembers);
    fs.writeFileSync(`previousMembers_${groupId}.json`, JSON.stringify(membersObject, null, 2));
}
