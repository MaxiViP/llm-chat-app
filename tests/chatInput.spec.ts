import { describe, it, beforeEach, afterEach, jest } from 'jest'
import { shallowMount } from '@vue/test-utils'
import ChatInput from '@/src/components/ChatInput.vue'

describe('ChatInput Component', ()::(() => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(ChatInput)
  })

  it('should be instantiated', () => {
    expect(wrapper.isVueInstance()).toBeTruthy()
  })

  it('should emit message when submit button clicked', async () => {
    const inputEvent = jest.fn()
    wrapper.vm.$emit = inputEvent

    await wrapper.find('form').trigger('submit')
    expect(inputEvent).toHaveBeenCalled()
  })

  it('should clear input field after submission', () => {
    expect(wrapper.vm.message).toBe('')
  })
})
