import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskTimePicker from "@/components/TaskTimePicker";

interface AddTaskInputProps {
  onAdd: (title: string, timeHHMM: string | null) => void;
}

const AddTaskInput = ({ onAdd }: AddTaskInputProps) => {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, time.trim() ? time.trim() : null);
    setTitle("");
    setTime("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Add a new task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-2xl border-0 bg-card shadow-sm"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-2xl" aria-label="Add task">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <TaskTimePicker value={time} onChange={setTime} />
    </form>
  );
};

export default AddTaskInput;
