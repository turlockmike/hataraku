export function getAttemptCompletionDescription(): string {
    return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. You should also suggest up to 3 relevant follow-up tasks based on the current task and its result. Optionally you may provide a CLI command to showcase the result of your work. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
- command: (optional) A CLI command to execute to show a live demo of the result to the user. For example, use \`open index.html\` to display a created html website, or \`open localhost:3000\` to display a locally running development server. But DO NOT use commands like \`echo\` or \`cat\` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- follow_up_tasks: (optional) An array of up to 3 short suggested follow-up tasks based on the current task and its result. These should be relevant improvements, extensions, or related tasks that would enhance the current work.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
<command>Command to demonstrate result (optional)</command>
<follow_up_tasks>
<item>First suggested follow-up task</item>
<item>Second suggested follow-up task</item>
<item>Third suggested follow-up task</item>
</follow_up_tasks>
</attempt_completion>

Example: Requesting to attempt completion with a result, command, and follow-up tasks
<attempt_completion>
<result>
I've updated the CSS styling for the landing page to use a modern design system with consistent spacing and typography.
</result>
<command>open index.html</command>
<follow_up_tasks>
<item>Add dark mode support to the new design system</item>
<item>Implement responsive breakpoints for mobile devices</item>
<item>Create documentation for the new design system components</item>
</follow_up_tasks>
</attempt_completion>`
}