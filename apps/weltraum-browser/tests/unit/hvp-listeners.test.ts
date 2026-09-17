import {expect,it,vi} from "vitest";
import {createHvpListeners} from "../../src/hestia-prototype/runtime/listeners";
it("removes the actual registered callbacks and remains idempotent",()=>{
  const target=new EventTarget(),scope=createHvpListeners(),called=vi.fn();
  scope.add(target,"change",called);expect(scope.size).toBe(1);target.dispatchEvent(new Event("change"));expect(called).toHaveBeenCalledTimes(1);
  scope.dispose();scope.dispose();expect(scope.size).toBe(0);target.dispatchEvent(new Event("change"));expect(called).toHaveBeenCalledTimes(1);
});
it("retains a failed registration rather than reporting a false zero",()=>{
  const target=new EventTarget(),scope=createHvpListeners(),a=vi.fn(),b=vi.fn();scope.add(target,"a",a);scope.add(target,"b",b);
  const original=target.removeEventListener.bind(target),remove=vi.spyOn(target,"removeEventListener").mockImplementation((type,listener,options)=>{
    if(type==="a"){throw new Error("remove failed");}original(type,listener,options);
  });
  expect(()=>scope.dispose()).toThrow("remove failed");expect(scope.size).toBe(1);target.dispatchEvent(new Event("b"));expect(b).not.toHaveBeenCalled();
  remove.mockRestore();scope.dispose();expect(scope.size).toBe(0);
});
