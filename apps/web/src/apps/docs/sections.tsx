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
          <Step title="Generate and schedule content">Content Studio and Content Calendar build on the brief. They are coming soon (see About).</Step>
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
        <P>A project holds everything for one brand: its Brand Brief now, and its content and calendar as those apps arrive. You need to be signed in.</P>
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
            ["Key messages", "The points every post should reinforce. Type one, press Enter to add the next (up to 20)."],
            ["Words to avoid", "Terms the AI must never use (up to 100)."],
            ["Sample posts", "Paste posts you love so the AI can copy the style (up to 10)."],
            ["Brand colors", "Pick a colour and press Add color (up to 10)."],
            ["Visual style", "Describe the look of your imagery."],
          ]}
        />
        <Callout kind="note">Product, audience and tone are required. Red messages under a field tell you what to fix.</Callout>
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
          <Step title="Read the plans">Free and Pro are listed with price and everything each includes. Your current plan is marked once you are signed in.</Step>
        </Steps>
        <H>Manage your plan</H>
        <Table
          head={["I want to…", "Do this"]}
          rows={[
            ["Upgrade", "Open Plans & Billing and press Upgrade to Pro. A secure checkout opens."],
            ["See my next payment", "Your plan card shows the next payment amount and date."],
            ["Cancel", "Press Cancel plan and confirm. You keep Pro until the end of the period you paid for."],
            ["Check my payments", "Billing history lists every charge with its date, amount and status."],
            ["Update my card", "Press Manage payment methods to open your Account."],
          ]}
        />
        <Callout kind="note">Billing is handled by Clerk and Stripe, so card details never touch MarketOS.</Callout>
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
