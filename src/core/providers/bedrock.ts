import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromIni } from '@aws-sdk/credential-provider-ini';

// Configure AWS SDK to use credentials from config file
process.env.AWS_SDK_LOAD_CONFIG = '1';

export async function createBedrockProvider(profile: string = 'default') {
    process.env.AWS_PROFILE = profile;
    const credentials = await fromIni({ profile })()
    return createAmazonBedrock({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
    })
}