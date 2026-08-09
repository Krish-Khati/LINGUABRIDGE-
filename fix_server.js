const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /speech_config: \{\s+voice: "zephyr",\s+\},/g,
  `speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: "Zephyr"
                }
              }
            },`
);

fs.writeFileSync('server.ts', code);
