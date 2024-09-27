import { BlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { Ref } from 'vue';

export type BlockArgsModel = {
  ready: boolean;
  args: Ref<BlockArgs>;
};

// function createArgs(): BlockArgsModel {
//   const args = ref<BlockArgs>();

//   const cancel = platforma.onStateUpdates(async patches => {
//     const argsPatch = patches.filter(p => p.key === 'args');
//     if(!argsPatch)
//         return;

//   })

//   onUnmounted(() => {

//   })

//   const { stop, ignoreUpdates } = watchIgnorable(source, (v) => console.log(`Changed to ${v}!`), {
//     immediate: true
//   });
// }
