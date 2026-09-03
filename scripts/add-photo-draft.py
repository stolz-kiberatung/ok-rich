"""One-off: add the "Write the photo mail" + "Draft photo mail" nodes to n8n/okrich-payments.json.

Run once from the repo root: python scripts/add-photo-draft.py [path-to-workflow.json]
Idempotent: re-running replaces the two nodes and the owner-mail sentence in place.
"""

import json
import sys
from pathlib import Path

# Optional argument: another workflow file, e.g. a live export from the server, so the nodes can
# be merged into the running workflow without losing its staticData (totals, board).
WF = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("n8n/okrich-payments.json")

JS = r"""// Writes the photo mail as a Gmail DRAFT for the owner to finish by hand: attach the thumb, hit
// send. Runs once per accepted payment, right after "Verify, dedupe, count".
//
// Two shapes:
//   - plain: the buyer paid for themselves, the mail goes to the payment address.
//   - gift:  the buyer typed a delivery address on /pay, the mail goes there. The recipient learns
//            the buyer's board name only, never the buyer's email address. An anonymous buyer is
//            introduced as "someone who wishes to stay anonymous".
//
// Deliberately NOT included: the buyer's checkout message. It is free text from a stranger and,
// for a gift, would be forwarded to someone who never agreed to receive it. The owner sees it in
// the "Email owner" mail and can quote it by hand.
//
// The template is picked from the payment id, not at random, so a redelivered event and the unit
// tests get the same mail every time. No em dashes: same rule as the site copy.

const p = $input.first().json;

const name = String(p.name || 'anonymous');
const anonymous = Boolean(p.anonymous) || /^anonymous$/i.test(name);
const amount = `${p.amount} ${p.currency}`;
const to = String(p.sendPhotoTo || p.email || '');
const gift = Boolean(p.deliverTo);
const paymentId = String(p.paymentId || '');

// Stable 0..n pick from the payment id (djb2). Same id, same joke.
function pick(n, seed) {
  let h = 5381;
  for (const ch of seed) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h % n;
}

const buyerName = anonymous ? 'someone who wishes to stay anonymous' : name;
const greeting = anonymous || gift ? 'Hi there,' : `Hi ${name},`;

// {amount} = paid amount, {who} = buyer as introduced to a gift recipient.
const PLAIN = [
  {
    subject: 'Your thumb has arrived',
    body: [
      `you paid ${amount} for a photo of my thumb. It is attached. Please treat it with the respect ${amount} deserves.`,
      'The thumb was raised in a quiet room, with clean nails, thinking about you specifically. It has since been lowered.',
      'You are, as of now, part of the reason I am a tiny bit richer. I will not forget this. My accountant might.',
    ],
  },
  {
    subject: 'One thumb, freshly raised',
    body: [
      `attached is the thumb you bought for ${amount}. It is the real one. No stock photo, no filter, no second thumb standing in.`,
      'Print it. Frame it. Set it as your lock screen. Show it to a colleague who asks what you spend money on. All valid.',
      'Thank you for funding the fund. The million is now measurably closer, in the sense that any number is closer than zero.',
    ],
  },
  {
    subject: 'Photo enclosed. It is a thumb.',
    body: [
      `here is what ${amount} buys on the internet in this economy: one thumbs-up, taken by hand, for you.`,
      'I want you to know that I looked at the camera and thought "this one is for a person with excellent judgement". Then I clicked.',
      'If it ever loses its power, do not worry. It does not lose its power.',
    ],
  },
  {
    subject: 'Delivery: 1x thumbs-up (yours)',
    body: [
      `your order of ${amount} has been fulfilled by a real thumb, attached below. Production time was roughly four seconds, plus finding good light.`,
      'This thumb has been approved by me, the only quality control this business has. It passed.',
      'Thanks for paying a stranger for a gesture. Honestly, it means a lot. It also means one more line on the board.',
    ],
  },
  {
    subject: 'The thumb you ordered',
    body: [
      `you gave ${amount} to a guy on the internet and asked for nothing but a thumb. Attached. Promise kept.`,
      'Some people buy stocks. Some buy crypto. You bought a photo of a thumb, which at least will never go down in value.',
      'I hope it finds you well, and slightly amused. That was the whole plan.',
    ],
  },
  {
    subject: 'Thumbs up. Officially.',
    body: [
      `this is the official thumbs-up you paid ${amount} for. It is attached, it is real, and it is pointing up.`,
      'Should anyone ask whether you have a professional opinion on your side, you now do. Attach this.',
      'Thank you. The fund grows, my nails stay trimmed, the world keeps turning.',
    ],
  },
  {
    subject: 'A thumb, with gratitude',
    body: [
      `thank you for the ${amount}. In return, as promised, a photo of my thumb, raised for you and nobody else.`,
      'I do not know what you will do with it, and I respect that. Possibilities are endless. Most of them involve a fridge.',
      'You are on the record now as a person who backs a good cause with a straight face. Rare. Appreciated.',
    ],
  },
  {
    subject: 'Handled: your thumb',
    body: [
      `your ${amount} went through, my thumb went up, the camera went click. The result is attached.`,
      'No AI was used in the making of this thumb. It is 100 percent hand. Locally sourced.',
      'Thanks for playing along. This is exactly the kind of nonsense the internet was built for.',
    ],
  },
];

const GIFT = [
  {
    subject: 'Someone bought you a thumb',
    body: [
      `${buyerName} paid ${amount} on ok-rich.com so that you would receive this: a real photo of my thumb, raised specifically in your honour. It is attached.`,
      'I do not know what you did to deserve it. Neither, possibly, do you. But someone thought of you and reached for their wallet, and that counts.',
      'Print it, frame it, forward it, or just enjoy the fact that this happened. All of those are correct.',
    ],
  },
  {
    subject: 'A thumb, sent on behalf of a friend',
    body: [
      `good news: ${buyerName} spent ${amount} to send you a thumbs-up. Not an emoji. A photograph of my actual thumb. Attached.`,
      'The thumb was raised with intent, in decent light, and lowered again once the photo was taken. It has done its job.',
      'You may now tell people you have received a personal thumbs-up from a stranger in Germany. Few can say that.',
    ],
  },
  {
    subject: 'Delivery for you: one thumbs-up',
    body: [
      `${buyerName} ordered this for you at ok-rich.com for ${amount}. It is a photo of my thumb, up, and it is attached to this mail.`,
      'Somebody looked at the internet, saw a man selling thumbs-up, and thought of you. Sit with that for a moment.',
      'If it ever stops working, it will not. Thumbs-ups do not expire.',
    ],
  },
  {
    subject: 'You have been thumbed',
    body: [
      `${buyerName} paid ${amount} for you to have this: a genuine, hand-made thumbs-up photo. See attachment.`,
      'It arrives with no strings attached, apart from the one string that you now know at least one person finds you thumb-worthy.',
      'Enjoy it. Someone went out of their way, and out of their money, to put it in your inbox.',
    ],
  },
  {
    subject: 'A gift. It is a thumb.',
    body: [
      `attached is a photo of my thumb, raised for you because ${buyerName} asked for it and paid ${amount} to make it happen.`,
      'As far as gifts go, it is small, it is odd, and it is entirely sincere. Which, if you think about it, is the best kind.',
      'Welcome to the very short list of people who have been gifted a thumb. It is a good list.',
    ],
  },
];

const set = gift ? GIFT : PLAIN;
const t = set[pick(set.length, paymentId)];

const closing = gift
  ? 'This thumb was made possible by the fund at https://ok-rich.com. No action needed on your side, and no further mail will follow.'
  : 'Your name is where it belongs, on the board at https://ok-rich.com. Thanks again.';

const body = [greeting, '', ...t.body.flatMap((line) => [line, '']), closing, '', 'Thumbs up,', 'Tobias', 'https://ok-rich.com', '', `Ref: ${paymentId}`].join('\n');

return [{ json: { to, subject: t.subject, body, gift, template: pick(set.length, paymentId), paymentId } }];
"""

wf = json.loads(WF.read_text(encoding="utf-8"))
if isinstance(wf, list):
    wf = wf[0]

WRITE_NAME = "Write the photo mail"
DRAFT_NAME = "Draft photo mail"

wf["nodes"] = [n for n in wf["nodes"] if n["name"] not in (WRITE_NAME, DRAFT_NAME)]

wf["nodes"].append(
    {
        "parameters": {"jsCode": JS},
        "id": "d3f7a9c2-5e81-4b06-9f4a-2c7e1b8d6a50",
        "name": WRITE_NAME,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [780, -480],
    }
)

gmail_cred = next(n["credentials"] for n in wf["nodes"] if n["name"] == "Email owner")

wf["nodes"].append(
    {
        "parameters": {
            "resource": "draft",
            "operation": "create",
            "subject": "={{ $json.subject }}",
            "emailType": "text",
            "message": "={{ $json.body }}",
            "options": {"sendTo": "={{ $json.to }}"},
        },
        "id": "e8b2c4d6-7a19-4f35-8d0c-9b3e5f1a2c74",
        "name": DRAFT_NAME,
        "type": "n8n-nodes-base.gmail",
        "typeVersion": 2.1,
        "position": [1040, -480],
        "credentials": gmail_cred,
        "notes": "Creates a DRAFT in the ok@ok-rich.com mailbox, addressed to sendPhotoTo. The owner attaches the thumb photo and sends it by hand. Nothing leaves the mailbox automatically.",
    }
)

# Wire: Refund? false branch (index 1) also feeds the writer; writer feeds the draft.
false_branch = wf["connections"]["Refund?"]["main"][1]
false_branch[:] = [c for c in false_branch if c["node"] != WRITE_NAME]
false_branch.append({"node": WRITE_NAME, "type": "main", "index": 0})
wf["connections"][WRITE_NAME] = {"main": [[{"node": DRAFT_NAME, "type": "main", "index": 0}]]}

# Owner mail: point at the draft.
owner = next(n for n in wf["nodes"] if n["name"] == "Email owner")
old = "Take the photo and email it to the buyer within 7 days. Delete this mail afterwards."
new = (
    "Take the photo within 7 days. The mail to {{ $json.sendPhotoTo }} is already waiting in Drafts "
    "(subject and text written, recipient set): attach the thumb and send. Delete this mail afterwards."
)
msg = owner["parameters"]["message"]
if old in msg:
    msg = msg.replace(old, new)
elif new not in msg:
    raise SystemExit("owner mail sentence not found; edit by hand")
owner["parameters"]["message"] = msg

WF.write_text(json.dumps(wf, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print("ok:", len(wf["nodes"]), "nodes")
