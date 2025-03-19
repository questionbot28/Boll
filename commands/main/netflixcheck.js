const { MessageEmbed } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

module.exports = {
    name: 'netflixcheck',
    description: 'Check Netflix cookies',
    usage: 'netflixcheck',
    async execute(message, args) {
        // Check if the user has permission to use this command
        const allowedRoleIDs = config.cookieCheckRoles || []; // Use a specific role setting or an empty array if not set
        const userRoles = message.member.roles.cache.map(role => role.id);

        // If the user doesn't have the required roles, deny permission
        if (!userRoles.some(role => allowedRoleIDs.includes(role))) {
            return message.reply('You do not have permission to use this command.');
        }

        // Check if a file was attached to the message
        const attachment = message.attachments.first();
        if (!attachment) {
            return message.reply('Please attach a file containing Netflix cookies to check.');
        }

        // Make sure the netflix directory exists
        const netflixDir = path.join(__dirname, '..', '..', 'netflix');
        if (!fs.existsSync(netflixDir)) {
            fs.mkdirSync(netflixDir, { recursive: true });
        }

        // Create a status embed
        const statusEmbed = new MessageEmbed()
            .setColor(config.color?.blue || '#0099ff')
            .setTitle('Netflix Cookie Checker')
            .setDescription('Processing your Netflix cookies...')
            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        const statusMessage = await message.channel.send({ embeds: [statusEmbed] });

        try {
            // Download the file
            const fileName = attachment.name;
            const filePath = path.join(netflixDir, fileName);

            // Create a write stream to save the file
            const writeStream = fs.createWriteStream(filePath);
            
            // Fetch the file content and pipe it to the write stream
            const response = await fetch(attachment.url);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }
            
            const fileStream = response.body;
            const streamPipeline = require('util').promisify(require('stream').pipeline);
            await streamPipeline(fileStream, writeStream);

            // Update status
            await statusMessage.edit({
                embeds: [
                    statusEmbed
                        .setDescription('File downloaded successfully. Starting cookie check process...')
                ]
            });

            // Run the Python script to check only the uploaded file
            const pythonProcess = spawn('python', ['netflix_cookie_checker.py', filePath]);

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
                console.log(`[Netflix Checker] ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
                console.error(`[Netflix Checker Error] ${data.toString().trim()}`);
            });

            // Update status periodically
            const updateInterval = setInterval(async () => {
                const updatedEmbed = new MessageEmbed()
                    .setColor(config.color?.blue || '#0099ff')
                    .setTitle('Netflix Cookie Checker')
                    .setDescription('Checking your Netflix cookies... This might take a few minutes.')
                    .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp();
                await statusMessage.edit({ embeds: [updatedEmbed] });
            }, 10000); // Update every 10 seconds

            pythonProcess.on('close', async (code) => {
                clearInterval(updateInterval);

                if (code !== 0 || errorData.includes('Error')) {
                    console.error(`Netflix cookie checker exited with code ${code}`);
                    await statusMessage.edit({
                        embeds: [
                            new MessageEmbed()
                                .setColor(config.color?.red || '#ff0000')
                                .setTitle('Netflix Cookie Checker - Error')
                                .setDescription(`An error occurred while checking the cookies: \n\`\`\`${errorData || 'Unknown error'}\`\`\``)
                                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                                .setTimestamp()
                        ]
                    });
                    return;
                }

                // Try to gather statistics from the output
                const stats = {
                    total: (outputData.match(/Total checked: (\d+)/i) || [])[1] || '0',
                    working: (outputData.match(/Working cookies: (\d+)/i) || [])[1] || '0',
                    unsubscribed: (outputData.match(/Unsubscribed accounts: (\d+)/i) || [])[1] || '0',
                    failed: (outputData.match(/Failed cookies: (\d+)/i) || [])[1] || '0',
                    broken: (outputData.match(/Broken cookies: (\d+)/i) || [])[1] || '0'
                };

                // Check if working cookies directory exists and has premium cookies
                const workingDir = path.join(__dirname, '..', '..', 'working_cookies', 'netflix', 'premium');
                let workingFiles = [];
                
                if (fs.existsSync(workingDir)) {
                    workingFiles = fs.readdirSync(workingDir).filter(file => file.endsWith('.txt'));
                }
                
                // Create success embed with results
                const resultsEmbed = new MessageEmbed()
                    .setColor(config.color?.green || '#00ff00')
                    .setTitle('Netflix Cookie Checker - Results')
                    .setDescription(`Check completed! Here are the results:`)
                    .addFields([
                        { name: 'Total Checked', value: stats.total, inline: true },
                        { name: 'Working Cookies', value: stats.working, inline: true },
                        { name: 'Unsubscribed', value: stats.unsubscribed, inline: true },
                        { name: 'Failed Cookies', value: stats.failed, inline: true },
                        { name: 'Broken Cookies', value: stats.broken, inline: true }
                    ])
                    .setImage('https://cdn.discordapp.com/attachments/1263458101886193725/1349031252216250503/350kb.gif?ex=67db8202&is=67da3082&hm=87a320f2ce832ed433016bb268feba16068c2d03cc7905166f7c1996b9cfb569&')
                    .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp();
                
                // Update the status message with the results
                await statusMessage.edit({ embeds: [resultsEmbed] });
                
                // Send a simple summary of working cookies if any
                if (workingFiles.length > 0) {
                    // Create a summary message without detailed cookie info
                    const workingSummary = new MessageEmbed()
                        .setColor(config.color?.green || '#00ff00')
                        .setTitle('Working Netflix Cookies')
                        .setDescription(`Found ${workingFiles.length} working Netflix cookies! Use \`.csend @user netflix\` to send them and see detailed information.`)
                        .setImage('https://cdn.discordapp.com/attachments/1263458101886193725/1349031252216250503/350kb.gif?ex=67db8202&is=67da3082&hm=87a320f2ce832ed433016bb268feba16068c2d03cc7905166f7c1996b9cfb569&')
                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp();
                    
                    await message.channel.send({ embeds: [workingSummary] });
                }
                
                // Clean up - delete the original file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Error in netflixcheck command:', error);
            await statusMessage.edit({
                embeds: [
                    new MessageEmbed()
                        .setColor(config.color?.red || '#ff0000')
                        .setTitle('Netflix Cookie Checker - Error')
                        .setDescription(`An error occurred: ${error.message}`)
                        .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp()
                ]
            });
        }
    },
};