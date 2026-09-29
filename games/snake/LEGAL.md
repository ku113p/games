# Legal screens: source text

A draft written by the agent at the game designer's request ("come up with a standard text yourself").
**The game designer reads and approves it**: it is his name under the text, not the agent's.
From here the strings go into `i18n/dictionaries.ts` and get translated into five languages.

---

## Screen 1. Photosensitivity warning

Shown **every time the site is opened**, before the menu. Dismissed with one button.

> ### Warning: flashing lights
>
> The game uses bright neon colors, flashes and rapidly changing images.
> For a small share of people, such images can trigger a seizure, even if they
> have never had one before.
>
> If while playing you feel dizzy, notice changes in your vision, muscle
> twitching or disorientation, or lose consciousness, **stop playing
> immediately** and see a doctor.
>
> Play in a well-lit room, do not play when tired, and take breaks.
>
> `[ Got it ]`

---

## Screen 2. Terms of use

Shown **only on the very first open**, after screen 1. The choice is remembered.

> ### Terms of use
>
> - The game is free and provided “as is”, without warranties of any kind.
>   The author is not liable for any damage arising from its use.
> - The game **sends nothing personal**: no name, no three letters,
>   no score, no player ID. Only a visit and a few nameless markers of how the
>   game went (for example, a round started, a round ended, you came back on
>   another day) leave it, through the GoatCounter counter, so the author can
>   tell whether the game is interesting. Like any website, the counter and the
>   site’s host (GitHub Pages, itch.io) can see technical request data.
> - High scores, your three letters, settings, coins with purchases, and a note
>   of your last visit are stored only in your browser and disappear along with
>   the site’s data.
> - Music: *Cyber Runner* by Luis Zuno (ansimuz), CC0 1.0 license.
> - By continuing, you confirm that you have read the warning about flashing lights.
>
> `[ I accept ]`

---

## What must be checked before release

1. **Analytics and the second bullet: done.** Analytics (GoatCounter, five
   counters: started, reached the twist, finished, second game, returned) is connected,
   and the second bullet of the terms has been rewritten for it: it no longer says "sends
   nothing", it names the kind of events ("for example, …") and what does not leave.
   The full list of the five events is in `analytics/events.ts`; the text deliberately
   does not list them all, but does not promise too much either. If there become more events
   or anything about a specific player shows up in them (score, letters, an ID),
   revisit the text again. Check by hand after release: events from the iframe
   on itch.io reach the dashboard (if not, look at which domains are allowed
   in the GoatCounter settings).
2. **Age and jurisdiction.** They are absent here on purpose: the game is free, does not
   collect personal data, has no purchases. If any of that changes, revisit the text.
3. **Translation of the legal text** is done by the agent. The wording is deliberately short
   and simple so that translation does not distort the meaning, but responsibility for the result
   is on the game designer.
