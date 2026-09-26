import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SpritePet from "@/components/pets/SpritePet";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh flex items-center justify-center px-sp-4">
      <div className="w-full max-w-[420px] flex flex-col items-center gap-sp-4 text-center">
        <SpritePet mood="excited" size={128} label="Lost rabbit" />
        <h1 className="text-24 font-bold text-focus-text leading-tight">That Page Hopped Away</h1>
        <p className="text-14 text-focus-muted max-w-xs">
          There's nothing at this address. Let's get you back to somewhere useful.
        </p>
        <div className="flex flex-col sm:flex-row gap-sp-2 w-full sm:w-auto">
          <Button variant="primary" size="md" onClick={() => navigate("/")}>Kids' Screen</Button>
          <Button variant="secondary" size="md" onClick={() => navigate("/parent")}>Parent Dashboard</Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
