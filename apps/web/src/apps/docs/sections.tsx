import { PLAN_LIMITS } from "@marketos/shared";
import type { ReactNode } from "react";
import { Callout, Figure, H, Kbd, P, Step, Steps, Table } from "./parts";

export interface DocSection {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
}

export const SECTIONS: DocSection[] = [
  {
    id: "start",
    title: "Getting started",
    summary: "What MarketOS is and the flow it is built around.",
    body: (
      <>
        <P>
          MarketOS is an AI workspace for solo marketers, presented as a small desktop on a beach. Every tool is an <strong>app</strong> that opens in its own window, so you can keep your
          projects, brand notes and content side by side.
        </P>
        <Figure src="/docs/01-desktop.png" alt="The MarketOS desktop in daylight" caption="The desktop: app icons on both sides, the menu bar on top, the mascot cat in the middle." />
        <H>The core flow</H>
        <Steps>
          <Step title="Create an account">Sign up with Google or email so your work is saved to you.</Step>
          <Step title="Create a project">A project is a folder for one brand, client or campaign.</Step>
          <Step title="Fill in its Brand Brief">Tell the AI who you sell to and how you sound.</Step>
          <Step title="Generate and schedule content">Content Studio writes drafts from the brief. Review and approve each one, then drag it onto a day in Content Calendar.</Step>
        </Steps>
        <Callout kind="tip">Everything has its own link. Paste a link such as <code>/apps/projects</code> into a new tab and that app opens straight away.</Callout>
      </>
    ),
  },
  {
    id: "desktop",
    title: "The desktop",
    summary: "Icons, the menu bar and the changing sky.",
    body: (
      <>
        <H>Icons</H>
        <P>App icons sit in two columns, left and right. Click an icon once to select it, double-click (or press <Kbd>Enter</Kbd> while it is selected) to open it. Click the empty beach to clear the selection.</P>
        <Steps>
          <Step title="Select">Click an icon. It gets a soft highlight.</Step>
          <Step title="Move between icons">Use the arrow keys <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd>.</Step>
          <Step title="Open">Double-click, or press <Kbd>Enter</Kbd>.</Step>
        </Steps>
        <H>The menu bar</H>
        <Table
          head={["Item", "What it does"]}
          rows={[
            ["Logo / MarketOS", "Brand mark on the left."],
            ["Projects, Pricing, Docs, About", "Open that app as a window."],
            ["Search icon", "Opens search: find apps, Docs sections and your projects. Shortcut: Ctrl/Cmd+K."],
            ["Selected project", "Shows the project you are working on. Click it to open Projects."],
            ["Sign in / Sign up", "Shown when you are signed out."],
            ["Round avatar", "Shown when you are signed in. Opens your Account window."],
          ]}
        />
        <H>Day and night</H>
        <P>The sky follows the time in Vietnam (UTC+7) and changes once an hour: sunrise, daytime, sunset and a moonlit night with campfire and lanterns glowing.</P>
        <Figure src="/docs/11-sunset.png" alt="The desktop at sunset" caption="Sunset: warm sky, long shadows." />
        <Figure src="/docs/10-night.png" alt="The desktop at night" caption="Night: moon, stars, lanterns and campfire light the beach." />
      </>
    ),
  },
  {
    id: "windows",
    title: "Working with windows",
    summary: "Open, move, resize, minimize, maximize and close.",
    body: (
      <>
        <Figure src="/docs/04-window.png" alt="An open app window" caption="A window: title bar with three round buttons on the right." />
        <H>The three round buttons</H>
        <Table
          head={["Button", "Hover colour", "Action"]}
          rows={[
            ["−", "Yellow", "Minimize: the window goes to the taskbar."],
            ["□", "Green", "Maximize, or restore the previous size."],
            ["×", "Red", "Close the window."],
          ]}
        />
        <H>Step by step</H>
        <Steps>
          <Step title="Open an app">Double-click its icon. Opening an app that is already open just brings it to the front.</Step>
          <Step title="Move it">Press and hold the title bar, then drag. The cursor turns into a paw while you drag. Windows cannot leave the desktop area.</Step>
          <Step title="Resize it">Drag any edge or corner. Windows are never smaller than 360 × 240.</Step>
          <Step title="Maximize">Double-click the title bar, or use the green button.</Step>
          <Step title="Bring to front">Click anywhere inside a window.</Step>
        </Steps>
        <Figure src="/docs/08-two-windows.png" alt="Two windows open at once" caption="Several windows can be open at once. New windows cascade down and to the right." />
        <H>The taskbar</H>
        <P>The bar at the bottom appears only when at least one app is open. It lists your open windows; the active one is highlighted. Click an entry to bring that window forward, or to restore it if it is minimized.</P>
        <Figure src="/docs/09-minimized.png" alt="One window minimized to the taskbar" caption="A minimized window stays in the taskbar, dimmed, until you click it." />
        <H>Keyboard</H>
        <Table
          head={["Keys", "Action"]}
          rows={[
            [<Kbd key="a">Esc</Kbd>, "Close the window you are working in."],
            [<span key="s"><Kbd>Ctrl</Kbd> + <Kbd>K</Kbd></span>, "Open search (Cmd + K on Mac). Use the arrow keys, Enter to open, Esc to close."],
            [<Kbd key="b">Enter</Kbd>, "Open the selected desktop icon."],
            [<span key="c"><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd></span>, "Move the selection between desktop icons."],
            [<Kbd key="d">Tab</Kbd>, "Move between buttons and fields."],
          ]}
        />
        <Callout kind="note">MarketOS remembers where you put each window and restores it next time, adjusted to your current screen size.</Callout>
      </>
    ),
  },
  {
    id: "account",
    title: "Create an account and sign in",
    summary: "Sign up, sign in, manage your profile and sign out.",
    body: (
      <>
        <H>Sign up</H>
        <Figure src="/docs/02-sign-up.png" alt="The Sign up window" caption="The Sign up window." />
        <Steps>
          <Step title="Open Sign up">Click the purple <strong>Sign up</strong> button in the top-right of the menu bar.</Step>
          <Step title="Choose a method">Press <strong>Continue with Google</strong>, or enter your email and a password.</Step>
          <Step title="Verify if asked">For email sign-up you may get a short code by email. Enter it to finish.</Step>
          <Step title="Done">The window closes and your avatar appears at the top right.</Step>
        </Steps>
        <H>Sign in</H>
        <Figure src="/docs/03-sign-in.png" alt="The Sign in window" caption="The Sign in window." />
        <Steps>
          <Step title="Open Sign in">Click <strong>Sign in</strong> in the menu bar, or press the Sign in button inside any app that asks you to.</Step>
          <Step title="Enter your details">Use Google, or your email and password, then press <strong>Continue</strong>.</Step>
        </Steps>
        <Callout kind="warn">&ldquo;The External Account was not found&rdquo; means that Google account has not been registered yet. Use <strong>Sign up</strong> first, then sign in.</Callout>
        <Figure src="/docs/05-projects-gate.png" alt="An app asking you to sign in" caption="Apps that store your data show this prompt until you are signed in." />
        <H>Your account</H>
        <Steps>
          <Step title="Open it">Click your round avatar in the top-right corner.</Step>
          <Step title="Manage">Update your name, photo, email addresses and security settings in the Account window.</Step>
          <Step title="Sign out">Use the <strong>Sign out</strong> button at the top of the Account window.</Step>
        </Steps>
      </>
    ),
  },
  {
    id: "projects",
    title: "Projects",
    summary: "Folders for your brands, clients and campaigns.",
    body: (
      <>
        <P>A project holds everything for one brand: its Brand Brief, its saved content and its calendar. You need to be signed in.</P>
        <H>Create a project</H>
        <Steps>
          <Step title="Open Projects">Double-click the Projects folder, or choose Projects in the menu bar.</Step>
          <Step title="Press New project">The button is at the top right of the window.</Step>
          <Step title="Name it">Give it a clear name, for example the brand or client. Names can be up to 120 characters.</Step>
          <Step title="Pick an icon and a colour">Choose one of six icons and six colours so folders are easy to tell apart.</Step>
          <Step title="Create project">The new folder appears and becomes your <strong>selected project</strong>.</Step>
        </Steps>
        <H>Select, rename and delete</H>
        <Table
          head={["I want to…", "Do this"]}
          rows={[
            ["Work on a project", "Click its folder. It shows a purple ring and a Selected badge, and its name appears in the menu bar."],
            ["Rename or restyle it", "Hover the folder, press the ⋯ button, then Rename / appearance."],
            ["Delete it", "Press ⋯, then Move to Trash. A toast offers Undo for a few seconds."],
          ]}
        />
        <Callout kind="tip">Moving a project to Trash is never permanent. You can restore it from the Trash app at any time.</Callout>
      </>
    ),
  },
  {
    id: "brief",
    title: "Brand Brief",
    summary: "Teach the AI about your brand once, reuse it everywhere.",
    body: (
      <>
        <P>The Brand Brief belongs to the <strong>selected project</strong>. If none is selected, the app shows a button that opens Projects so you can pick one.</P>
        <Steps>
          <Step title="Select a project">Click a folder in Projects.</Step>
          <Step title="Open Brand Brief">Double-click its palette icon.</Step>
          <Step title="Fill in the fields">See the table below.</Step>
          <Step title="Press Save">The status next to the button changes from &ldquo;Unsaved changes&rdquo; to &ldquo;Saved&rdquo;.</Step>
        </Steps>
        <Table
          head={["Field", "What to write"]}
          rows={[
            ["Product / service", "What you sell and what makes it different."],
            ["Target audience", "Who buys it: age, interests, problems."],
            ["Tone of voice", "For example: friendly, approachable, a little humorous."],
            ["Content language", "The language the AI writes in for every channel. Vietnamese by default."],
            ["Key messages", "The points every post should reinforce. Type one, press Enter to add the next (up to 20)."],
            ["Words to avoid", "Terms the AI must never use (up to 100)."],
            ["Sample posts", "Paste posts you love so the AI can copy the style (up to 10)."],
            ["Brand colors", "Pick a colour and press Add color (up to 10)."],
            ["Visual style", "Describe the look of your imagery."],
            ["Business address (optional)", "Used in the footer of email content. Leave it empty if you don't send email; the AI then leaves a placeholder for you to fill in."],
          ]}
        />
        <Callout kind="note">Product, audience and tone are required. Red messages under a field tell you what to fix.</Callout>
      </>
    ),
  },
  {
    id: "studio",
    title: "Content Studio",
    summary: "Let the AI write post variants from your brief.",
    body: (
      <>
        <P>Content Studio writes for the <strong>selected project</strong>, in the language and voice of its Brand Brief. The project needs a brief first; if it has none, the app offers a button to open Brand Brief.</P>
        <Steps>
          <Step title="Pick a channel">Facebook, Instagram, TikTok, LinkedIn, YouTube, Email or Blog. Each has its own length and format rules.</Step>
          <Step title="Describe the post">Fill in the goal and topic, and add notes if you like.</Step>
          <Step title="Generate">Three variants appear as the AI writes them. Press Stop to cancel.</Step>
          <Step title="Keep the best">Edit a variant in place, copy it, or press <strong>Save as draft</strong>. Not happy with one? Press <strong>Regenerate</strong> on that card to get a new version while the others stay. Regenerates are cheaper: every 3 count as 1 generation (the 1st of each 3 is counted, the next 2 are free), across all your projects each month.</Step>
        </Steps>
        <H>Review and approve</H>
        <P>Every saved draft starts as <strong>Needs review</strong>. Read it, press <strong>Approve</strong> and tick the checklist. Only approved content can go on the calendar.</P>
        <Callout kind="tip">If a draft still has text in brackets, such as [Business address] or {"{{unsubscribe_link}}"}, the checklist warns you to fill it in before posting.</Callout>
        <Callout kind="note">Editing an approved or scheduled post sends it back to Needs review. Posts marked Done can no longer be edited.</Callout>
      </>
    ),
  },
  {
    id: "calendar",
    title: "Content Calendar",
    summary: "Schedule approved content by dragging it onto a day.",
    body: (
      <>
        <Table
          head={["I want to…", "Do this"]}
          rows={[
            ["Schedule a post", "Drag it from the Unscheduled column onto a day. It is set for 9:00 AM; open it to change the time."],
            ["Move it to another day", "Drag it to the new day. The time stays the same."],
            ["Unschedule it", "Drag it back to the Unscheduled column. It stays approved."],
            ["Change status or time", "Click it to open details, then pick a status, date and time and press Save."],
            ["Mark it as posted", "Open it and set the status to Done."],
            ["Switch views", "Use Month or Week at the top right, and the arrows or Today to move around."],
          ]}
        />
        <Callout kind="note">Drafts that still need review show a dashed border and a Review tag. Approve them before they can be scheduled.</Callout>
      </>
    ),
  },
  {
    id: "assistant",
    title: "AI Assistant",
    summary: "Chat about a project; apply its suggestions in one click (Pro).",
    body: (
      <>
        <P>The AI Assistant is part of <strong>Pro</strong> and works on the <strong>selected project</strong>. It reads the project&apos;s Brand Brief and its recent posts, and replies in the language you write in.</P>
        <Steps>
          <Step title="Open AI Assistant">Double-click its chat-bubble icon. The project needs a Brand Brief.</Step>
          <Step title="Ask">Type a question or a request, then press Enter (Shift+Enter for a new line). Press Stop to cut a reply short.</Step>
          <Step title="Review suggestions">Under a reply you may see cards: a new draft, an edit to a post, a schedule, or a Brand Brief change, with what changes.</Step>
          <Step title="Apply or dismiss">Nothing changes until you press <strong>Apply</strong>. Dismiss hides a suggestion.</Step>
        </Steps>
        <Table
          head={["Suggestion", "What Apply does"]}
          rows={[
            ["New draft", "Saves it as Needs review. You still approve it before it can be scheduled."],
            ["Edit a post", "Updates the post. An approved post goes back to Needs review."],
            ["Schedule", "Puts an approved post on the calendar, or moves its date. Posts that still need review can't be scheduled."],
            ["Brand Brief change", "Updates only the fields shown; everything else in the brief stays the same."],
          ]}
        />
        <Callout kind="note">The assistant never approves, deletes or marks posts as Done. Pro includes {PLAN_LIMITS.pro.assistant} messages a month; your usage is in Plans &amp; Billing. Clear deletes the project&apos;s chat history but doesn&apos;t give messages back.</Callout>
      </>
    ),
  },
  {
    id: "automations",
    title: "Automations",
    summary: "Let routine work run on a schedule, with your review (Max).",
    body: (
      <>
        <P>Automations are part of <strong>Max</strong> and belong to the <strong>selected project</strong>. The project needs a Brand Brief, or its automations are skipped.</P>
        <Steps>
          <Step title="Open Automations">Double-click its clock icon and press <strong>New automation</strong>.</Step>
          <Step title="Choose what it does">Pick a type, fill in its settings and give it a name.</Step>
          <Step title="Choose when it runs">Every day, on chosen weekdays or on a day of the month, at a time in your time zone.</Step>
          <Step title="Check the results">Open <strong>History</strong> on an automation to see each run and jump to the drafts, the calendar or the chat it touched. <strong>Run now</strong> tries it straight away.</Step>
        </Steps>
        <Table
          head={["Type", "What it does"]}
          rows={[
            ["Write posts", "Writes 1–5 drafts for the channels you pick. They wait in Needs review."],
            ["Schedule approved posts", "Puts approved posts without a date into your time slots over the next days, skipping slots that already have a post."],
            ["Weekly report", "Sends a summary of done, scheduled and waiting posts to the project's AI Assistant chat."],
            ["Custom instruction", "Runs your instruction like an assistant message. Drafts are saved for review; other suggestions wait for you to press Apply in the chat."],
          ]}
        />
        <Callout kind="note">Automations never approve, delete or mark posts as Done. Max includes {PLAN_LIMITS.max.automations} automations turned on (across all projects) and {PLAN_LIMITS.max.automationRuns} runs a month; every run counts, even one that fails or is skipped. Pausing turns off future runs; if your plan leaves Max, every automation is paused and stays paused until you turn it back on.</Callout>
      </>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    summary: "See where a project's posts stand and what's coming up.",
    body: (
      <>
        <P>Reports shows the <strong>selected project</strong>. It counts every saved post, so it always matches Content Studio and the calendar.</P>
        <Table
          head={["Section", "What it shows"]}
          rows={[
            ["Tiles", "All posts, Needs review, Approved with no date, Scheduled ahead and Done. Click a tile to open where you act on it."],
            ["Posts by channel", "How many posts each channel has, split by status."],
            ["Next 4 weeks", "Scheduled posts per week, starting Monday. Empty weeks are flagged so you can fill them."],
            ["AI usage this month", "Generations, AI Assistant messages and automation runs, across all projects."],
            ["Export CSV", "Downloads every post of the project (title, channel, status, dates, text, hashtags, call to action) as a CSV file that opens in Excel or Google Sheets."],
          ]}
        />
        <Callout kind="note">Views, clicks and engagement per post will come once channels can be connected in Integrations.</Callout>
      </>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    summary: "Beach scene, animations, notifications and window layout.",
    body: (
      <>
        <Table
          head={["Setting", "What it does"]}
          rows={[
            ["Beach scene", "Follow the clock (the sky changes through the day), or keep sunrise, daytime, sunset or night."],
            ["Scene clock", "Which clock the sky follows: Vietnam time or your device's time zone."],
            ["Animations", "Follow your device's reduce-motion setting, always reduce motion, or always show it."],
            ["Notifications", "Desktop notifications and posting reminders (the same switches as in the bell)."],
            ["Reset window layout", "Forgets where you put each window and how big it is, and puts open windows back in their default place."],
          ]}
        />
        <Callout kind="note">Settings are saved in this browser, so another device keeps its own.</Callout>
      </>
    ),
  },
  {
    id: "trash",
    title: "Trash",
    summary: "Restore projects you removed.",
    body: (
      <>
        <Steps>
          <Step title="Open Trash">Double-click the Trash icon.</Step>
          <Step title="Find the project">Each row shows the project and when it was deleted.</Step>
          <Step title="Restore">Press <strong>Restore</strong>. The project returns to Projects with its Brand Brief intact.</Step>
        </Steps>
      </>
    ),
  },
  {
    id: "billing",
    title: "Pricing and billing",
    summary: "Compare plans, upgrade, cancel and see your payments.",
    body: (
      <>
        <P>Two apps work together. <strong>Pricing</strong> (menu bar) explains each plan and what it includes. <strong>Plans &amp; Billing</strong> (desktop icon) is where you manage your own subscription.</P>
        <H>Compare plans</H>
        <Steps>
          <Step title="Open Pricing">Choose Pricing in the menu bar.</Step>
          <Step title="Read the plans">Free, Pro and Max are listed with price and everything each includes. Your current plan is marked once you are signed in.</Step>
        </Steps>
        <H>Manage your plan</H>
        <Table
          head={["I want to…", "Do this"]}
          rows={[
            ["Upgrade", "Open Plans & Billing and press Upgrade to Pro or Upgrade to Max. A secure checkout opens."],
            ["See my next payment", "Your plan card shows the next payment amount and date."],
            ["See my usage", `The Usage card shows active projects and AI generations used this month, and when generations reset. Free: ${PLAN_LIMITS.free.projects} projects, ${PLAN_LIMITS.free.text} generations. Pro: ${PLAN_LIMITS.pro.projects} projects, ${PLAN_LIMITS.pro.text} generations. Max: ${PLAN_LIMITS.max.projects} projects, ${PLAN_LIMITS.max.text} generations, plus automations turned on and automation runs.`],
            ["Cancel", "Press Cancel plan and confirm. You keep your paid plan until the end of the period you paid for."],
            ["Check my payments", "Billing history lists every charge with its date, amount and status."],
            ["Update my card", "Press Manage payment methods to open your Account."],
          ]}
        />
        <Callout kind="note">Billing is handled by Clerk and Stripe, so card details never touch MarketOS.</Callout>
      </>
    ),
  },
  {
    id: "notifications",
    title: "Notifications",
    summary: "Toasts, the bell and posting reminders.",
    body: (
      <>
        <P>Short messages slide in at the bottom right after an action, with a button to jump to the right app when it helps. Important ones are also kept in the bell at the top right.</P>
        <H>The bell</H>
        <Table
          head={["You will find", "When"]}
          rows={[
            ["Your 3 variants are ready", "AI finished writing while Content Studio was minimized, behind another window or in another tab."],
            ["Posting reminders", "A summary of today's scheduled posts, and a reminder 15 minutes before each one."],
            ["Account updates", "A project moved to Trash or restored, a Brand Brief saved, a plan cancelled."],
          ]}
        />
        <Steps>
          <Step title="Open a notification">Click it to open the related app. It is marked as read.</Step>
          <Step title="Tidy up">Use Mark all read, or Clear all at the bottom of the list.</Step>
          <Step title="Change settings">Press the settings icon in the bell to turn reminders or desktop notifications on or off.</Step>
        </Steps>
        <H>Desktop notifications</H>
        <P>Turn on Desktop notifications in the bell settings and allow them when your browser asks. You will then get a notice on your computer when content is ready or a post is due, but only while MarketOS is in a background tab.</P>
        <Callout kind="note">Reminders follow the project you have selected, and only cover approved posts that are on the calendar.</Callout>
      </>
    ),
  },
  {
    id: "mobile",
    title: "On your phone",
    summary: "The same desktop, adapted to small screens.",
    body: (
      <>
        <P>On screens narrower than 768 px the desktop adapts: icons become a grid, and each app opens as a full-screen sheet.</P>
        <div className="grid grid-cols-2 gap-4">
          <Figure narrow src="/docs/06-mobile-home.png" alt="Mobile home with icon grid" caption="Icons in a grid. Tap once to open." />
          <Figure narrow src="/docs/07-mobile-sheet.png" alt="An app open as a full-screen sheet" caption="Tap Back to return." />
        </div>
        <Callout kind="note">There is no taskbar on mobile and only one app is shown at a time. Dragging and resizing are turned off.</Callout>
      </>
    ),
  },
  {
    id: "links",
    title: "Links and browser buttons",
    summary: "Every app has its own address.",
    body: (
      <>
        <P>The address bar always reflects the window in front, and your browser&apos;s Back and Forward buttons move between windows.</P>
        <Table
          head={["Address", "Opens"]}
          rows={[
            [<code key="1">/</code>, "The empty desktop."],
            [<code key="2">/apps/projects</code>, "Projects."],
            [<code key="3">/apps/brand-brief</code>, "Brand Brief."],
            [<code key="4">/apps/trash</code>, "Trash."],
            [<code key="7">/apps/pricing</code>, "Pricing."],
            [<code key="5">/apps/docs</code>, "This guide."],
            [<code key="6">/apps/about</code>, "About."],
          ]}
        />
        <P>Closing a window takes you to the next window in front, or to <code>/</code> if none is left. Unknown addresses show an &ldquo;App not found&rdquo; message.</P>
      </>
    ),
  },
  {
    id: "faq",
    title: "Troubleshooting",
    summary: "Common questions and fixes.",
    body: (
      <>
        <Table
          head={["Problem", "Fix"]}
          rows={[
            ["An app only shows “Sign in to continue”.", "That app saves data to your account. Sign in or sign up from the menu bar."],
            ["“The External Account was not found.”", "That Google account is not registered yet. Use Sign up first."],
            ["I closed a project by mistake.", "Open Trash and press Restore, or press Undo in the toast right after deleting."],
            ["A window is off to the side after resizing my browser.", "Windows are pulled back inside the desktop automatically. Drag it by the title bar to reposition."],
            ["“Your session has expired.”", "Sign in again from the menu bar."],
            ["“The server isn't ready.”", "The service is temporarily unavailable. Wait a moment and press Try again."],
            ["The Taskbar is missing.", "It only appears while at least one app is open."],
          ]}
        />
      </>
    ),
  },
];
