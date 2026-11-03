import { Suspense } from "react";
import { Editor } from "@/components/editor/Editor";

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense>
      <EditorForParams params={params} />
    </Suspense>
  );
}

async function EditorForParams({ params }: Pick<PageProps<"/projects/[id]">, "params">) {
  const { id } = await params;
  return <Editor id={id} />;
}
