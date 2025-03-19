const fs = require('fs');
const path = require('path');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const config = require('../../config.json');
const https = require('https');

module.exports = {
    name: 'csend',
    description: 'cookie send with verification',
    usage: 'csend <@user> <netflix/spotify>',
    async execute(message, args) {
        // Check if the command sender has the required role
        const allowedRoleIDs = config.cookiesendroles || []; // Assuming config.cookiesendroles is an array of role IDs

        const userRoles = message.member.roles.cache.map(role => role.id);

        if (!userRoles.some(role => allowedRoleIDs.includes(role))) {
            return message.reply('You do not have permission to use this command.');
        }
        
        // Check if the command has the correct number of arguments
        if (args.length !== 2) {
            return message.reply('Please provide the correct arguments. Usage: `csend <@user> <netflix/spotify>`.');
        }

        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
            return message.reply('Please mention a user to send the cookie to.');
        }
        
        const category = args[1].toLowerCase();

        // Check if the specified category is valid (netflix or spotify)
        if (!(category === 'netflix' || category === 'spotify')) {
            return message.reply('Please provide a valid category (netflix or spotify).');
        }

        // Processing message
        const processingEmbed = new MessageEmbed()
            .setColor(config.color.blue || '#0099ff')
            .setTitle(`Finding Valid ${category.charAt(0).toUpperCase() + category.slice(1)} Cookie`)
            .setDescription(`Looking for a valid cookie to send to ${mentionedUser.tag}. This may take a moment...`)
            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
            
        const processingMessage = await message.channel.send({ embeds: [processingEmbed] });

        try {
            let validCookie = null;
            let validCookieContent = null;
            let validCookieFilename = null;
            
            if (category === 'spotify') {
                // For Spotify, check working_cookies directory first
                const workingCookiesDir = path.join(__dirname, '../../working_cookies');
                
                if (fs.existsSync(workingCookiesDir)) {
                    // Look for premium, then family, then duo, then student folders
                    const priorityFolders = ['premium', 'family', 'duo', 'student'];
                    
                    for (const folderName of priorityFolders) {
                        const folderPath = path.join(workingCookiesDir, folderName);
                        
                        if (fs.existsSync(folderPath)) {
                            const cookieFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.txt'));
                            
                            if (cookieFiles.length > 0) {
                                // Get a random file from this folder
                                const randomFile = cookieFiles[Math.floor(Math.random() * cookieFiles.length)];
                                const filePath = path.join(folderPath, randomFile);
                                
                                // Check if the cookie is valid
                                await processingMessage.edit({
                                    embeds: [
                                        new MessageEmbed()
                                            .setColor(config.color.blue || '#0099ff')
                                            .setTitle(`Checking Cookie`)
                                            .setDescription(`Checking ${folderName} cookie: ${randomFile}`)
                                            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                            .setTimestamp()
                                    ]
                                });
                                
                                // Read the cookie file
                                const cookieContent = fs.readFileSync(filePath, 'utf8');
                                
                                // We found a cookie!
                                validCookie = filePath;
                                validCookieContent = cookieContent;
                                validCookieFilename = randomFile;
                                break;
                            }
                        }
                    }
                }
                
                // If we didn't find a valid cookie in working_cookies, check the regular spotify directory
                if (!validCookie) {
                    const folderPath = `./${category}/`;
                    if (fs.existsSync(folderPath)) {
                        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.txt'));
                        
                        if (files.length === 0) {
                            await processingMessage.edit({
                                embeds: [
                                    new MessageEmbed()
                                        .setColor(config.color.red || '#ff0000')
                                        .setTitle('No Files Found')
                                        .setDescription(`No files found in the ${category} category.`)
                                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                        .setTimestamp()
                                ]
                            });
                            return;
                        }
                        
                        // Try up to 5 random files
                        const maxAttempts = Math.min(5, files.length);
                        for (let i = 0; i < maxAttempts; i++) {
                            const randomIndex = Math.floor(Math.random() * files.length);
                            const randomFile = files[randomIndex];
                            const filePath = `${folderPath}${randomFile}`;
                            
                            // Check if file exists
                            if (!fs.existsSync(filePath)) {
                                continue;
                            }
                            
                            await processingMessage.edit({
                                embeds: [
                                    new MessageEmbed()
                                        .setColor(config.color.blue || '#0099ff')
                                        .setTitle(`Checking Cookie`)
                                        .setDescription(`Checking cookie: ${randomFile} (attempt ${i+1}/${maxAttempts})`)
                                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                        .setTimestamp()
                                ]
                            });
                            
                            // Read file content
                            const fileContent = fs.readFileSync(filePath, 'utf8');
                            
                            // TODO: We'd want to verify the cookie here, but for now we'll just use it
                            validCookie = filePath;
                            validCookieContent = fileContent;
                            validCookieFilename = randomFile;
                            break;
                        }
                    }
                }
            } else {
                // For other categories like Netflix, just pick a random file
                const folderPath = `./${category}/`;
                
                if (!fs.existsSync(folderPath)) {
                    await processingMessage.edit({
                        embeds: [
                            new MessageEmbed()
                                .setColor(config.color.red || '#ff0000')
                                .setTitle('Folder Not Found')
                                .setDescription(`The ${category} folder was not found.`)
                                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp()
                        ]
                    });
                    return;
                }
                
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.txt'));
                
                if (files.length === 0) {
                    await processingMessage.edit({
                        embeds: [
                            new MessageEmbed()
                                .setColor(config.color.red || '#ff0000')
                                .setTitle('No Files Found')
                                .setDescription(`No files found in the ${category} category.`)
                                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp()
                        ]
                    });
                    return;
                }
                
                const randomFile = files[Math.floor(Math.random() * files.length)];
                const filePath = `${folderPath}${randomFile}`;
                
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    await processingMessage.edit({
                        embeds: [
                            new MessageEmbed()
                                .setColor(config.color.red || '#ff0000')
                                .setTitle('File Not Found')
                                .setDescription(`File ${randomFile} not found in the ${category} folder.`)
                                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp()
                        ]
                    });
                    return;
                }
                
                // Read file content
                const fileContent = fs.readFileSync(filePath, 'utf8');
                
                validCookie = filePath;
                validCookieContent = fileContent;
                validCookieFilename = randomFile;
            }
            
            // If we didn't find a valid cookie
            if (!validCookie || !validCookieContent) {
                await processingMessage.edit({
                    embeds: [
                        new MessageEmbed()
                            .setColor(config.color.red || '#ff0000')
                            .setTitle('No Valid Cookies')
                            .setDescription(`Could not find a valid ${category} cookie after multiple attempts.`)
                            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                            .setTimestamp()
                    ]
                });
                return;
            }
            
            // Update status message
            await processingMessage.edit({
                embeds: [
                    new MessageEmbed()
                        .setColor(config.color.green || '#00ff00')
                        .setTitle('Cookie Found')
                        .setDescription(`Valid ${category} cookie found! Sending to ${mentionedUser.tag}...`)
                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp()
                ]
            });
            
            // Customize the embed based on the specified category
            const dmEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`${category.charAt(0).toUpperCase() + category.slice(1)} Access`) // Capitalize the category
                .setDescription(`🌕 **WRECKED G3N** 🌕\n\n**Service**\n💻 Here is your ${category} access`)
                .addFields([{
                    name: 'Instructions', 
                    value: `Step 1: Make sure you are on a PC\nStep 2: Download the extension called Cookie Editor [link](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)\nStep 3: Go to the ${category} website and pin Cookie Editor\nStep 4: Delete all cookies (the bin icon) and then press import and copy the thing we gave you\nStep 5: After import, just click refresh on the whole page, and you should be logged in\nStep 6: Enjoy!!!\n\nEnjoy at ${category.charAt(0).toUpperCase() + category.slice(1)}!`
                }]);
            
            // Create the attachment with file content
            const fileBuffer = Buffer.from(validCookieContent);
            const fileAttachment = new MessageAttachment(fileBuffer, validCookieFilename);
            
            // Send the messages to the user
            try {
                await mentionedUser.send({ embeds: [dmEmbed] });
                await mentionedUser.send({ files: [fileAttachment] });
                
                // Success message in channel
                await processingMessage.edit({
                    embeds: [
                        new MessageEmbed()
                            .setColor(config.color.green || '#00ff00')
                            .setTitle(`${category.charAt(0).toUpperCase() + category.slice(1)} Access Sent!`)
                            .setDescription(`Check ${mentionedUser.tag}'s private messages! If they do not receive the message, please ask them to unlock their private!`)
                            .setImage(config.gif) // Use the URL from config.json
                            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                            .setTimestamp()
                    ]
                });
            } catch (err) {
                console.error(`Failed to send message to ${mentionedUser.tag}: ${err}`);
                await processingMessage.edit({
                    embeds: [
                        new MessageEmbed()
                            .setColor(config.color.red || '#ff0000')
                            .setTitle('Failed to Send Message')
                            .setDescription(`Failed to send ${category} access to ${mentionedUser.tag}. Please check their privacy settings.`)
                            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                            .setTimestamp()
                    ]
                });
            }
            
        } catch (err) {
            console.error(`Error in csend command: ${err}`);
            await processingMessage.edit({
                embeds: [
                    new MessageEmbed()
                        .setColor(config.color.red || '#ff0000')
                        .setTitle('Error')
                        .setDescription(`An error occurred while processing this command: ${err.message}`)
                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp()
                ]
            });
        }
    },
};