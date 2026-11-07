<script setup lang="ts">
import { computed } from "vue";
import { screenName, type ScreenId } from "@/lib/nav";

const props = defineProps<{
  screen: ScreenId;
}>();

const name = computed(() => screenName(props.screen));
</script>

<template>
  <div class="screen-title-block" style="margin-bottom: 14px;">
    <div class="screen-title">{{ name }}</div>
  </div>
</template>
