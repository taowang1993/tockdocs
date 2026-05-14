<script lang="ts">
import { defineComponent, h, useAttrs } from 'vue'

export default defineComponent({
  inheritAttrs: false,
  props: {
    src: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const attrs = useAttrs()

    return () => h('img', {
      ...attrs,
      src: props.src,
      alt: props.alt,
    })
  },
})
</script>
