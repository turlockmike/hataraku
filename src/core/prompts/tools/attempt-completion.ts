export function getAttemptCompletionDescription(): string {
    return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.

Usage:
<attempt_completion>
<r>
Your final result description here
</r>
</attempt_completion>

Example: Requesting to attempt completion with a result
<attempt_completion>
<r>
I've updated the CSS styling for the landing page to use a modern design system with consistent spacing and typography.
</r>
</attempt_completion>`
}