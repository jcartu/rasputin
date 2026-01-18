import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

async function showNotification(
  title: string,
  message: string,
  options?: { sound?: boolean; subtitle?: string }
): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    const script = options?.subtitle
      ? `display notification "${message}" with title "${title}" subtitle "${options.subtitle}"${options?.sound ? ' sound name "default"' : ""}`
      : `display notification "${message}" with title "${title}"${options?.sound ? ' sound name "default"' : ""}`;
    await $`osascript -e ${script}`;
  } else if (platform === "win32") {
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
      $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
      $xml.GetElementsByTagName("text")[0].AppendChild($xml.CreateTextNode("${title}"))
      $xml.GetElementsByTagName("text")[1].AppendChild($xml.CreateTextNode("${message}"))
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Rasputin").Show($toast)
    `;
    await $`powershell -command ${ps}`;
  } else {
    await $`notify-send ${title} ${message}`;
  }
}

export const NotificationTool = Tool.define("desktop_notification", {
  description: `Show a system notification on the user's desktop.
Useful for alerting the user about completed tasks, important events, or requiring attention.`,

  parameters: z.object({
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification body text"),
    subtitle: z.string().optional().describe("Subtitle (macOS only)"),
    sound: z
      .boolean()
      .optional()
      .default(false)
      .describe("Play notification sound"),
  }),

  async execute(args, ctx) {
    await showNotification(args.title, args.message, {
      sound: args.sound,
      subtitle: args.subtitle,
    });
    return {
      output: `Notification shown: "${args.title}"`,
      metadata: { title: args.title, message: args.message },
    };
  },
});
