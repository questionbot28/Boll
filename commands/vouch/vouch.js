// commands/vouch/vouch.js
const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('vouches.db');
const config = require('../../config.json');

module.exports = {
    name: 'vouch',
    description: 'Vouch for a user.',
    usage: 'vouch <@user> {reason}',
    execute(message, args, prefix) {
        // Check if the command is used in the specified vouch channel
        if (message.channel.id !== config.vouchChannelId) {
            return message.channel.send(`This command can only be used in <#${config.vouchChannelId}>.`);
        }

        const mentionedUser = message.mentions.users.first();

        if (!mentionedUser) {
            return message.channel.send(`Usage: ${prefix}vouch @user {reason}`);
        }

        // Allow vouching for any user, no staff role check
        const reason = args.slice(1).join(' ');

        db.run(`INSERT OR IGNORE INTO vouches (user_id) VALUES (?)`, [mentionedUser.id]);
        db.run(`UPDATE vouches SET vouches = vouches + 1, todayvouches = todayvouches + 1, last3daysvouches = last3daysvouches + 1, lastweekvouches = lastweekvouches + 1 WHERE user_id = ?`, [mentionedUser.id]);
        db.run(`UPDATE vouches SET reasons = json_insert(reasons, '$[0]', ?) WHERE user_id = ?`, [reason, mentionedUser.id]);

        const vouchEmbed = new Discord.MessageEmbed()
            .setColor('#00ff00')
            .setTitle('✅ Positive Review')
            .setDescription(`Successfully vouched for ${mentionedUser.tag} ${reason ? `with reason: ${reason}` : ''}`);

        message.channel.send(vouchEmbed);


        // After processing the vouch command, check and assign auto role for the mentioned user
        const vouchKey = mentionedUser.id;
        db.get('SELECT vouches FROM vouches WHERE user_id = ?', [vouchKey], async (err, row) => {
            if (err) {
                console.error(`Error retrieving vouch count: ${err.message}`);
                return;
            }

            // Assuming promoRoleID is defined somewhere in your code
            const promoRoleID = '1200663200358727712'; // Replace with the actual promotion role ID

            // Check if the user has the promotion role
            if (message.guild.members.cache.get(mentionedUser.id).roles.cache.has(promoRoleID)) {

                // Check vouch count and assign auto role based on tiers
                const autoRoleTiers = config.autoRoleTiers;

                for (const tier of autoRoleTiers) {
                    if (row.vouches >= tier.threshold) {
                        const autoRole = message.guild.roles.cache.get(tier.roleID);

                        if (autoRole) {
                            // Check if the member already has the auto role
                            if (!message.guild.members.cache.get(mentionedUser.id).roles.cache.has(autoRole.id)) {
                                try {
                                    await message.guild.members.cache.get(mentionedUser.id).roles.add(autoRole);
                                    console.log(`Auto role (${autoRole.name}) assigned to ${mentionedUser.tag} in ${message.guild.name} (${row.vouches} vouches).`);

                                    // Send an embed to the promotion channel
                                    const promotionChannel = message.guild.channels.cache.get(config.promotionChannelId);

                                    if (promotionChannel instanceof Discord.TextChannel) {
                                        const embed = new Discord.MessageEmbed()
                                            .setColor('#00FF00') // Green color for success
                                            .setTitle('User Promotion')
                                            .setDescription(`Congratulations to ${mentionedUser.tag} for reaching ${tier.threshold} vouches!`)
                                            .addField('New Role', autoRole.name, true)
                                            .addField('Vouch Count', row.vouches, true)
                                            .setTimestamp();

                                        promotionChannel.send(embed);
                                    } else {
                                        console.error(`Promotion channel not found. Check your configuration.`);
                                    }
                                } catch (error) {
                                    console.error(`Error assigning auto role: ${error.message}`);
                                }
                            } else {
                                console.log(`${mentionedUser.tag} already has the auto role (${autoRole.name}).`);
                            }
                        } else {
                            console.error(`Auto role (${tier.roleID}) not found. Check your configuration.`);
                        }
                    }
                }
            } else {
                console.log(`${mentionedUser.tag} does not have the promotion role. Skipping auto role check.`);
            }
        });
    },
};
