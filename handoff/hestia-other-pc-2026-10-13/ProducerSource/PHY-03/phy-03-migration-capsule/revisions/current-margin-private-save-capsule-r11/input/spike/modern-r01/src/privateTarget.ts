// Same task-owned target guard; importing this policy never opens a repository.
export function requirePrivateDatabase(name:string):void{
  if(!/^phy03-migration-capsule-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(name))throw new Error("Task-owned private database required");
}
