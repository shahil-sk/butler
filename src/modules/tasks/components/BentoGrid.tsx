import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { TaskCard } from "./TaskCard";
import type { Task } from "@/shared/types";
import type { Priority } from "@/shared/types";

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  priorityFilter: Priority | null;
  onPriorityFilter: (p: Priority) => void;
}

export function BentoGrid({ tasks, onOpenTask, onToggleComplete, priorityFilter, onPriorityFilter }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredTasks = priorityFilter ? tasks.filter(t => t.priority === priorityFilter) : tasks;

  useGSAP(() => {
    if (!gridRef.current) return;
    const cards = gsap.utils.toArray<HTMLElement>(".task-card");
    if (cards.length === 0) return;
    gsap.fromTo(cards, 
      { y: 60, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.05, ease: "power3.out", clearProps: "all" }
    );
  }, { scope: gridRef, dependencies: [filteredTasks.map(t => t.id).join(",")] });

  const handlePriorityClick = (e: React.MouseEvent, priority: string) => {
    e.stopPropagation();
    onPriorityFilter(priority as Priority);
  };

  if (tasks.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-xl text-muted-foreground font-medium">Your canvas is clear.</p>
      </div>
    );
  }

  return (
    <div ref={gridRef} className="w-full mx-auto px-4 md:px-8 pb-32 flex justify-center">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-min gap-4 md:gap-6 place-content-center" style={{ gridAutoFlow: 'dense' }}>
        {filteredTasks.map((task) => (
          <TaskCard 
            key={task.id}
            task={task} 
            onOpen={() => onOpenTask(task.id)} 
            onToggleComplete={() => onToggleComplete(task.id)} 
            onPriorityClick={handlePriorityClick}
          />
        ))}
      </div>
    </div>
  );
}
