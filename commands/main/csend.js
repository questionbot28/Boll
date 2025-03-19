const fs = require('fs');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    name: 'csend',
    description: 'cookie send',
    usage: 'csend <@user> <netflix/spotify>',
    execute(message, args) {
        // Check if the command sender has the required role
        const allowedRoleIDs = config.cookiesendroles; // Assuming config.cookiesendroles is an array of role IDs

        const userRoles = message.member.roles.cache.map(role => role.id);

        if (!userRoles.some(role => allowedRoleIDs.includes(role))) {
            return message.reply('You do not have permission to use this command.');
        }
        // Check if the command has the correct number of arguments
        if (args.length !== 2) {
            return message.reply('Please provide the correct arguments. Usage: `csend <@user> <netflix/spotify>`.');
        }

        const mentionedUser = message.mentions.users.first();
        const category = args[1].toLowerCase();

        // Check if the specified category is valid (netflix or spotify)
        if (!(category === 'netflix' || category === 'spotify')) {
            return message.reply('Please provide a valid category (netflix or spotify).');
        }

        // Get a random file from the specified category
        const folderPath = `./${category}/`;
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.txt'));

        if (files.length === 0) {
            return message.reply(`No files found in the ${category} category.`);
        }

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const filePath = `${folderPath}${randomFile}`;

        try {
            // Check if file exists before proceeding
            if (!fs.existsSync(filePath)) {
                return message.reply(`File ${randomFile} not found in the ${category} folder.`);
            }
            
            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            // Customize the embed based on the specified category
            const dmEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`${category.charAt(0).toUpperCase() + category.slice(1)} Access`) // Capitalize the category
                .setDescription(`🌕 **WRECKED G3N** 🌕\n\n**Service**\n💻 Here is your ${category} access`)
                .addField('Instructions', `Step 1: Make sure you are on a PC\nStep 2: Download the extension called Cookie Editor [link](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)\nStep 3: Go to the ${category} website and pin Cookie Editor\nStep 4: Delete all cookies (the bin icon) and then press import and copy the thing we gave you\nStep 5: After import, just click refresh on the whole page, and you should be logged in\nStep 6: Enjoy!!!\n\nEnjoy at ${category.charAt(0).toUpperCase() + category.slice(1)}!`);
            
            // Create the attachment with file content
            const fileBuffer = Buffer.from(fileContent);
            const fileAttachment = new MessageAttachment(fileBuffer, randomFile);
            
            // Send the messages to the user
            mentionedUser.send({ embeds: [dmEmbed] }).then(() => {
                mentionedUser.send({ files: [fileAttachment] }).then(() => {
                    message.channel.send({
                        embeds: [
                            new MessageEmbed()
                                .setColor('#00ff00') // Green color for success
                                .setTitle(`${category.charAt(0).toUpperCase() + category.slice(1)} Access Sent!`)
                                .setDescription(`Check ${mentionedUser.tag}'s private messages! If they do not receive the message, please ask them to unlock their private!`)
                                .setImage(config.gif) // Use the URL from config.json
                                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp()
                        ]
                    });
                }).catch((err) => {
                    console.error(`Failed to send file to ${mentionedUser.tag}: ${err}`);
                    message.reply(`Failed to send file to ${mentionedUser.tag}. Please check the user's privacy settings.`);
                });
            }).catch((err) => {
                console.error(`Failed to send DM to ${mentionedUser.tag}: ${err}`);
                message.reply(`Failed to send DM to ${mentionedUser.tag}. Please check the user's privacy settings.`);
            });
        } catch (err) {
            console.error(`Error in csend command: ${err}`);
            message.reply(`An error occurred while processing this command: ${err.message}`);
        }
    },
};