import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VoxelSprite from "@/components/voxel/VoxelSprite";
import { VOXEL_CHARACTERS } from "@/components/voxel/voxelCharacters";

/**
 * Gallery of the six voxel critters at /preview/voxels — handy for reviewing
 * proportions, palette and expressions side by side.
 */
const VoxelCharactersPreview = () => {
  const [animated, setAnimated] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-violet-50 to-amber-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Voxel Critters</h1>
            <p className="text-slate-500">
              Six original characters on one shared chibi body plan.
            </p>
          </div>
          <Button variant="outline" onClick={() => setAnimated((a) => !a)}>
            {animated ? "Pause idle motion" : "Play idle motion"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VOXEL_CHARACTERS.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <VoxelSprite model={c} size={180} animated={animated} />
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-800">{c.name}</h2>
                  <p className="text-sm text-slate-500">{c.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoxelCharactersPreview;
