// Starting points for new documents, like Zoom Docs templates.

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  content: () => string;
}

const today = () => new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "blank",
    name: "Blank document",
    description: "Start from scratch",
    title: "Untitled",
    content: () => "",
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Agenda, notes and action items",
    title: "Meeting notes",
    content: () =>
      `Date: ${today()}\nAttendees:\n\nAgenda\n1. \n2. \n3. \n\nNotes\n- \n\nAction items\n- [ ] Owner: Task (due date)\n`,
  },
  {
    id: "project-plan",
    name: "Project plan",
    description: "Goals, milestones and risks",
    title: "Project plan",
    content: () =>
      "Overview\nWhat are we building and why?\n\nGoals\n- \n\nMilestones\n| Milestone | Owner | Date |\n| --- | --- | --- |\n|  |  |  |\n\nRisks\n- \n\nOpen questions\n- \n",
  },
  {
    id: "one-on-one",
    name: "1:1 agenda",
    description: "Topics, wins and next steps",
    title: "1:1 agenda",
    content: () => `Date: ${today()}\n\nWins since last time\n- \n\nTopics to discuss\n- \n\nNext steps\n- \n`,
  },
];
